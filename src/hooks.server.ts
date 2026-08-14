import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, getSessionUser, hasUsers } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins(): string[] {
	return (env.ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((o) => o.trim().replace(/\/+$/, ''))
		.filter(Boolean);
}

// Allow same-origin requests (works for any host you open the app on — hostname,
// LAN IP, localhost) plus any origins listed in ALLOWED_ORIGINS.
function forbiddenCrossOrigin(request: Request): boolean {
	if (SAFE_METHODS.has(request.method)) return false;
	const origin = request.headers.get('origin');
	if (!origin) return false;
	let originHost: string;
	try {
		originHost = new URL(origin).host;
	} catch {
		return true;
	}
	const host = request.headers.get('host');
	if (host && originHost === host) return false;
	return !allowedOrigins().includes(origin.replace(/\/+$/, ''));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (forbiddenCrossOrigin(event.request)) {
		return new Response('Cross-site request forbidden', { status: 403 });
	}

	const sessionId = event.cookies.get(SESSION_COOKIE);
	const user = getSessionUser(sessionId);
	event.locals.user = user ? { id: user.id, username: user.username } : null;

	const path = event.url.pathname;
	const setupDone = hasUsers();

	if (!setupDone && !path.startsWith('/setup')) {
		throw redirect(303, '/setup');
	}
	if (setupDone && path.startsWith('/setup')) {
		throw redirect(303, event.locals.user ? '/admin' : '/login');
	}
	if (path.startsWith('/admin') && !event.locals.user) {
		throw redirect(303, '/login');
	}
	if (path === '/login' && event.locals.user) {
		throw redirect(303, '/admin');
	}

	return resolve(event);
};
