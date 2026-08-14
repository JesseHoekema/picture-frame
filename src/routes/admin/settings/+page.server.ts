import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSettings, updateSettings, type Settings, type StorageBackend } from '$lib/server/settings';
import { normalizeEndpoint } from '$lib/server/minio';
import { testBackend } from '$lib/server/storage';
import { getStates, testConnection } from '$lib/server/homeassistant';
import { listAlbums, testConnection as testImmich, type ImmichAlbum } from '$lib/server/immich';
import { testConnection as testOwm } from '$lib/server/openweather';
import { notifyFrameChange } from '$lib/server/frameEvents';
import { clearAll as clearMediaCache } from '$lib/server/mediaCache';
import {
	getUserById,
	getUserByUsername,
	updatePassword,
	updateUsername,
	verifyPassword
} from '$lib/server/auth';

interface EntityOption {
	entity_id: string;
	name: string;
}

async function loadEntities(s: Settings) {
	const result = {
		motion: [] as EntityOption[],
		weather: [] as EntityOption[],
		display: [] as EntityOption[],
		sensor: [] as EntityOption[],
		error: null as string | null
	};
	if (!s.haUrl || !s.haToken) return result;
	try {
		const states = await getStates();
		for (const st of states) {
			const domain = st.entity_id.split('.')[0];
			const name = (st.attributes?.friendly_name as string) ?? st.entity_id;
			const opt = { entity_id: st.entity_id, name };
			if (domain === 'binary_sensor') result.motion.push(opt);
			else if (domain === 'weather') result.weather.push(opt);
			else if (domain === 'switch' || domain === 'light' || domain === 'media_player')
				result.display.push(opt);
			if (domain === 'sensor' || domain === 'binary_sensor') result.sensor.push(opt);
		}
		const sort = (a: EntityOption, b: EntityOption) => a.name.localeCompare(b.name);
		result.motion.sort(sort);
		result.weather.sort(sort);
		result.display.sort(sort);
		result.sensor.sort(sort);
	} catch (err) {
		result.error = err instanceof Error ? err.message : String(err);
	}
	return result;
}

async function loadImmichAlbums(s: Settings): Promise<{ albums: ImmichAlbum[]; error: string | null }> {
	if (s.storageBackend !== 'immich' || !s.immichUrl || !s.immichApiKey) {
		return { albums: [], error: null };
	}
	try {
		return { albums: await listAlbums(), error: null };
	} catch (err) {
		return { albums: [], error: err instanceof Error ? err.message : String(err) };
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const settings = getSettings();
	const [entities, immich] = await Promise.all([
		loadEntities(settings),
		loadImmichAlbums(settings)
	]);
	return { settings, entities, immich, username: locals.user?.username ?? '' };
};

export const actions: Actions = {
	slideshow: async ({ request }) => {
		const f = await request.formData();
		updateSettings({
			slideDurationSec: Math.max(2, Number(f.get('slideDurationSec') ?? 10)),
			shuffle: f.get('shuffle') === 'true',
			transition: (String(f.get('transition') ?? 'fade') as Settings['transition']),
			fit: (String(f.get('fit') ?? 'cover') as Settings['fit'])
		});
		return { saved: 'slideshow' };
	},

	overlay: async ({ request }) => {
		const f = await request.formData();
		const weatherSource = (String(f.get('weatherSource') ?? 'ha') as Settings['weatherSource']);
		const owmApiKey = String(f.get('owmApiKey') ?? '').trim();
		const owmLocation = String(f.get('owmLocation') ?? '').trim();
		const owmUnits = (String(f.get('owmUnits') ?? 'metric') as Settings['owmUnits']);

		if (weatherSource === 'openweathermap' && owmApiKey && owmLocation) {
			const test = await testOwm(owmApiKey, owmLocation, owmUnits);
			if (!test.ok) return fail(400, { section: 'overlay', error: `Weather: ${test.error}` });
		}

		updateSettings({
			showClock: f.get('showClock') === 'true',
			showWeather: f.get('showWeather') === 'true',
			clockFormat: (String(f.get('clockFormat') ?? '24h') as Settings['clockFormat']),
			weatherSource,
			owmApiKey,
			owmLocation,
			owmUnits
		});
		notifyFrameChange();
		return { saved: 'overlay' };
	},

	storage: async ({ request }) => {
		const f = await request.formData();
		const backend = (String(f.get('storageBackend') ?? 'local') as StorageBackend) || 'local';
		const patch: Partial<Settings> = { storageBackend: backend };

		if (backend === 'minio') {
			const norm = normalizeEndpoint(
				String(f.get('minioEndpoint') ?? ''),
				Number(f.get('minioPort') ?? 9000),
				f.get('minioUseSSL') === 'true'
			);
			patch.minioEndpoint = norm.endpoint;
			patch.minioPort = norm.port;
			patch.minioUseSSL = norm.useSSL;
			patch.minioAccessKey = String(f.get('minioAccessKey') ?? '').trim();
			patch.minioSecretKey = String(f.get('minioSecretKey') ?? '').trim();
			patch.minioBucket = String(f.get('minioBucket') ?? 'picture-frame').trim();
			if (!patch.minioEndpoint || !patch.minioAccessKey || !patch.minioSecretKey) {
				return fail(400, { section: 'storage', error: 'Endpoint, access key and secret key are required.' });
			}
			const test = await testBackend(patch);
			if (!test.ok) return fail(400, { section: 'storage', error: `Connection failed: ${test.error}` });
			if (test.useSSL !== undefined) patch.minioUseSSL = test.useSSL;
		} else if (backend === 'immich') {
			patch.immichUrl = String(f.get('immichUrl') ?? '').trim().replace(/\/$/, '');
			patch.immichApiKey = String(f.get('immichApiKey') ?? '').trim();
			patch.immichAlbumId = String(f.get('immichAlbumId') ?? '').trim();
			if (!patch.immichUrl || !patch.immichApiKey) {
				return fail(400, { section: 'storage', error: 'Immich server URL and API key are required.' });
			}
			const test = await testImmich(patch.immichUrl, patch.immichApiKey);
			if (!test.ok) return fail(400, { section: 'storage', error: `Connection failed: ${test.error}` });
		} else {
			await testBackend({ storageBackend: 'local' });
		}

		const previousBackend = getSettings().storageBackend;
		updateSettings(patch);
		if (previousBackend !== backend) {
			await clearMediaCache();
			notifyFrameChange();
		}
		return { saved: 'storage' };
	},

	immichAlbum: async ({ request }) => {
		const f = await request.formData();
		updateSettings({ immichAlbumId: String(f.get('immichAlbumId') ?? '').trim() });
		return { saved: 'immichAlbum' };
	},

	homeassistant: async ({ request }) => {
		const f = await request.formData();
		const haUrl = String(f.get('haUrl') ?? '').trim();
		const haToken = String(f.get('haToken') ?? '').trim();
		if (haUrl && haToken) {
			const test = await testConnection(haUrl, haToken);
			if (!test.ok) return fail(400, { section: 'ha', error: `Connection failed: ${test.error}` });
		}
		updateSettings({ haUrl, haToken });
		return { saved: 'homeassistant' };
	},

	account: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { section: 'account', error: 'Not signed in.' });
		const f = await request.formData();
		const username = String(f.get('username') ?? '').trim();
		const currentPassword = String(f.get('currentPassword') ?? '');
		const newPassword = String(f.get('newPassword') ?? '');

		const user = getUserById(locals.user.id);
		if (!user) return fail(400, { section: 'account', error: 'Account not found.' });
		if (!verifyPassword(currentPassword, user.password_hash)) {
			return fail(400, { section: 'account', error: 'Current password is incorrect.' });
		}
		if (username.length < 3) {
			return fail(400, { section: 'account', error: 'Username must be at least 3 characters.' });
		}
		const clash = getUserByUsername(username);
		if (clash && clash.id !== user.id) {
			return fail(400, { section: 'account', error: 'That username is taken.' });
		}
		if (newPassword && newPassword.length < 6) {
			return fail(400, { section: 'account', error: 'New password must be at least 6 characters.' });
		}

		if (username !== user.username) updateUsername(user.id, username);
		if (newPassword) updatePassword(user.id, newPassword);
		return { saved: 'account' };
	},

	motion: async ({ request }) => {
		const f = await request.formData();
		const frameSensors = String(f.get('frameSensors') ?? '')
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean);
		updateSettings({
			haMotionEntity: String(f.get('haMotionEntity') ?? '').trim(),
			haWeatherEntity: String(f.get('haWeatherEntity') ?? '').trim(),
			haDisplayEntity: String(f.get('haDisplayEntity') ?? '').trim(),
			frameSensors,
			motionEnabled: f.get('motionEnabled') === 'true',
			motionTimeoutSec: Math.max(10, Number(f.get('motionTimeoutSec') ?? 300)),
			screenLightEnabled: f.get('screenLightEnabled') === 'true',
			screenLightEntity: String(f.get('screenLightEntity') ?? '').trim()
		});
		notifyFrameChange();
		return { saved: 'motion' };
	}
};
