import type { LayoutServerLoad } from './$types';
import { isStorageConfigured } from '$lib/server/settings';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		storageConfigured: isStorageConfigured()
	};
};
