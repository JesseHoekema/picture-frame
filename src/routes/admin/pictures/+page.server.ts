import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listImages, saveUpload, deleteImage, reorderImages } from '$lib/server/images';
import { getSettings, isStorageConfigured } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	return {
		images: await listImages(),
		storageConfigured: isStorageConfigured(),
		backend: getSettings().storageBackend
	};
};

export const actions: Actions = {
	upload: async ({ request }) => {
		if (!isStorageConfigured()) {
			return fail(400, { error: 'Configure storage in Settings first.' });
		}
		const form = await request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length === 0) return fail(400, { error: 'No files selected.' });

		let saved = 0;
		const errors: string[] = [];
		for (const file of files) {
			const res = await saveUpload(file, 'admin', null);
			if (res.ok) saved++;
			else errors.push(`${file.name}: ${res.error}`);
		}
		if (saved === 0) return fail(400, { error: errors.join(' ') || 'Upload failed.' });
		return { uploaded: saved, warnings: errors };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Invalid id.' });
		await deleteImage(id);
		return { deleted: true };
	},

	reorder: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('order') ?? '');
		const ids = raw
			.split(',')
			.map((x) => Number(x))
			.filter((x) => Number.isFinite(x));
		if (ids.length === 0) return fail(400, { error: 'Empty order.' });
		reorderImages(ids);
		return { reordered: true };
	}
};
