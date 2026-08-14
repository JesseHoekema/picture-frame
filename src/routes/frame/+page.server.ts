import type { PageServerLoad } from './$types';
import { listImages } from '$lib/server/images';
import { getPublicFrameSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const images = (await listImages()).map((i) => ({ id: i.id }));
	return {
		settings: getPublicFrameSettings(),
		images,
		serverTime: Date.now()
	};
};
