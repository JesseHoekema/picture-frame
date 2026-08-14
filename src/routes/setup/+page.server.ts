import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createSession, createUser, hasUsers, SESSION_COOKIE } from '$lib/server/auth';
import { updateSettings, type Settings, type StorageBackend } from '$lib/server/settings';
import { normalizeEndpoint } from '$lib/server/minio';
import { testBackend } from '$lib/server/storage';
import { testConnection as testImmich } from '$lib/server/immich';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		if (hasUsers()) throw redirect(303, '/login');

		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		const backend = (String(form.get('storageBackend') ?? 'local') as StorageBackend) || 'local';

		const values = {
			username,
			storageBackend: backend,
			minioEndpoint: String(form.get('minioEndpoint') ?? ''),
			minioPort: Number(form.get('minioPort') ?? 9000),
			minioAccessKey: String(form.get('minioAccessKey') ?? ''),
			minioBucket: String(form.get('minioBucket') ?? 'picture-frame'),
			immichUrl: String(form.get('immichUrl') ?? '')
		};

		if (username.length < 3) return fail(400, { error: 'Username must be at least 3 characters.', values });
		if (password.length < 6) return fail(400, { error: 'Password must be at least 6 characters.', values });
		if (password !== confirm) return fail(400, { error: 'Passwords do not match.', values });

		const patch: Partial<Settings> = { storageBackend: backend };

		if (backend === 'minio') {
			const norm = normalizeEndpoint(
				String(form.get('minioEndpoint') ?? ''),
				Number(form.get('minioPort') ?? 9000),
				form.get('minioUseSSL') === 'on' || form.get('minioUseSSL') === 'true'
			);
			patch.minioEndpoint = norm.endpoint;
			patch.minioPort = norm.port;
			patch.minioUseSSL = norm.useSSL;
			patch.minioAccessKey = String(form.get('minioAccessKey') ?? '').trim();
			patch.minioSecretKey = String(form.get('minioSecretKey') ?? '').trim();
			patch.minioBucket = String(form.get('minioBucket') ?? 'picture-frame').trim();
			if (!patch.minioEndpoint || !patch.minioAccessKey || !patch.minioSecretKey) {
				return fail(400, { error: 'Endpoint, access key and secret key are required.', values });
			}
			const test = await testBackend(patch);
			if (!test.ok) return fail(400, { error: `Could not connect to storage: ${test.error}`, values });
			if (test.useSSL !== undefined) patch.minioUseSSL = test.useSSL;
		} else if (backend === 'immich') {
			patch.immichUrl = String(form.get('immichUrl') ?? '').trim().replace(/\/$/, '');
			patch.immichApiKey = String(form.get('immichApiKey') ?? '').trim();
			if (!patch.immichUrl || !patch.immichApiKey) {
				return fail(400, { error: 'Immich server URL and API key are required.', values });
			}
			const test = await testImmich(patch.immichUrl, patch.immichApiKey);
			if (!test.ok) return fail(400, { error: `Could not connect to Immich: ${test.error}`, values });
		} else {
			await testBackend({ storageBackend: 'local' });
		}

		updateSettings(patch);
		const user = createUser(username, password);
		const sessionId = createSession(user.id);
		cookies.set(SESSION_COOKIE, sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30
		});

		throw redirect(303, '/admin');
	}
};
