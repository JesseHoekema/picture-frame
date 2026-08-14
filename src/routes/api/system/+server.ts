import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSystemStats } from '$lib/server/systemStats';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	return json(getSystemStats(), { headers: { 'cache-control': 'no-store' } });
};
