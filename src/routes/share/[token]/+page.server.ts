import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getShareLinkByToken,
	checkShareLinkPassword
} from '$lib/server/shareLinks';
import { saveUpload } from '$lib/server/images';
import { isStorageConfigured } from '$lib/server/settings';

function unlockCookie(token: string) {
	return `pf_unlock_${token}`;
}

export const load: PageServerLoad = async ({ params, cookies }) => {
	const link = getShareLinkByToken(params.token);
	if (!link) throw error(404, 'This share link does not exist.');

	const hasPassword = !!link.password_hash;
	const unlocked = !hasPassword || cookies.get(unlockCookie(link.token)) === '1';

	return {
		name: link.name,
		enabled: !!link.enabled,
		hasPassword,
		unlocked,
		uploadCount: link.upload_count
	};
};

export const actions: Actions = {
	unlock: async ({ params, request, cookies }) => {
		const link = getShareLinkByToken(params.token);
		if (!link) throw error(404, 'Not found');
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (!checkShareLinkPassword(link, password)) {
			return fail(400, { error: 'Incorrect password.' });
		}
		cookies.set(unlockCookie(link.token), '1', {
			path: `/share/${link.token}`,
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.COOKIE_SECURE === 'true',
			maxAge: 60 * 60 * 24
		});
		return { unlocked: true };
	},

	upload: async ({ params, request, cookies }) => {
		const link = getShareLinkByToken(params.token);
		if (!link) throw error(404, 'Not found');
		if (!link.enabled) return fail(403, { error: 'This link has been disabled.' });

		const unlocked =
			!link.password_hash || cookies.get(unlockCookie(link.token)) === '1';
		if (!unlocked) return fail(403, { error: 'Enter the password first.' });

		if (!isStorageConfigured()) {
			return fail(503, { error: 'The frame owner has not finished setting up storage yet.' });
		}

		const form = await request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length === 0) return fail(400, { error: 'No files selected.' });

		let saved = 0;
		const errors: string[] = [];
		for (const file of files) {
			const res = await saveUpload(file, 'share', link.id);
			if (res.ok) saved++;
			else errors.push(`${file.name}: ${res.error}`);
		}
		if (saved === 0) return fail(400, { error: errors.join(' ') || 'Upload failed.' });
		return { uploaded: saved, warnings: errors };
	}
};
