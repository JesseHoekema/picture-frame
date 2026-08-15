import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	createSession,
	getUserByUsername,
	SESSION_COOKIE,
	verifyPassword
} from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const user = getUserByUsername(username);
		if (!user || !verifyPassword(password, user.password_hash)) {
			return fail(400, { error: 'Invalid username or password.', username });
		}

		const sessionId = createSession(user.id);
		cookies.set(SESSION_COOKIE, sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 30
		});
		throw redirect(303, '/admin');
	}
};
