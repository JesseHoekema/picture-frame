import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	listShareLinks,
	createShareLink,
	setShareLinkEnabled,
	deleteShareLink,
	updateShareLinkPassword
} from '$lib/server/shareLinks';

export const load: PageServerLoad = async () => {
	return { links: listShareLinks() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!name) return fail(400, { error: 'Give the link a name.' });
		createShareLink(name, password || undefined);
		return { created: true };
	},

	toggle: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const enabled = form.get('enabled') === 'true';
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		setShareLinkEnabled(id, enabled);
		return { toggled: true };
	},

	setPassword: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const password = String(form.get('password') ?? '');
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		updateShareLinkPassword(id, password || null);
		return { passwordSet: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		deleteShareLink(id);
		return { deleted: true };
	}
};
