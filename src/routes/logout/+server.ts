import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession, SESSION_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) deleteSession(sessionId);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	throw redirect(303, '/login');
};
