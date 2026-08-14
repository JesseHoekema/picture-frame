import type { Actions, PageServerLoad } from './$types';
import { getSettings, isStorageConfigured, updateSettings } from '$lib/server/settings';
import { listImages } from '$lib/server/images';
import { listShareLinks } from '$lib/server/shareLinks';
import { notifyFrameChange } from '$lib/server/frameEvents';
import { getSystemStats } from '$lib/server/systemStats';

export const actions: Actions = {
	screenPower: async ({ request }) => {
		const f = await request.formData();
		updateSettings({ screenPower: f.get('screenPower') === 'true' });
		notifyFrameChange();
		return { ok: true };
	},

	pollInterval: async ({ request }) => {
		const f = await request.formData();
		const value = Math.min(3600, Math.max(1, Math.round(Number(f.get('pollIntervalSec') ?? 15))));
		updateSettings({ pollIntervalSec: value });
		notifyFrameChange();
		return { ok: true, pollIntervalSec: value };
	}
};

export const load: PageServerLoad = async ({ locals }) => {
	const s = getSettings();
	const images = await listImages();
	const links = listShareLinks();

	const storageLabel =
		s.storageBackend === 'local'
			? 'On this server'
			: s.storageBackend === 'minio'
				? 'MinIO / S3'
				: 'Immich';

	const storageDetail =
		s.storageBackend === 'local'
			? "Photos are stored on this server's disk."
			: s.storageBackend === 'minio'
				? `Bucket “${s.minioBucket}” at ${s.minioEndpoint || 'not set'}`
				: `${s.immichUrl || 'Immich'} · ${s.immichAlbumId ? 'selected album' : 'recent library'}`;

	const weatherLabel = !s.showWeather
		? 'Off'
		: s.weatherSource === 'openweathermap'
			? 'OpenWeatherMap'
			: 'Home Assistant';

	return {
		username: locals.user?.username ?? '',
		screenPower: s.screenPower,
		pollIntervalSec: s.pollIntervalSec,
		storageBackend: s.storageBackend,
		storageLabel,
		storageDetail,
		storageConfigured: isStorageConfigured(),
		imageCount: images.length,
		firstImageId: images[0]?.id ?? null,
		linkCount: links.length,
		enabledLinkCount: links.filter((l) => l.enabled).length,
		slideDurationSec: s.slideDurationSec,
		shuffle: s.shuffle,
		showClock: s.showClock,
		showWeather: s.showWeather,
		weatherLabel,
		haConnected: !!(s.haUrl && s.haToken),
		motionEnabled: s.motionEnabled,
		motionTimeoutSec: s.motionTimeoutSec,
		nodeVersion: process.version,
		appName: 'Picture Frame',
		system: getSystemStats()
	};
};
