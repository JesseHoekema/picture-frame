import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeFrameLiveState } from '$lib/server/displayController';

export const GET: RequestHandler = async () => {
	const state = await computeFrameLiveState();
	return json(state, {
		headers: { 'cache-control': 'no-store' }
	});
};
