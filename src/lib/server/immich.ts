import { randomUUID } from 'node:crypto';
import { getSettings } from './settings';
import type { Readable } from 'node:stream';

function base(url?: string, key?: string) {
	const s = getSettings();
	return {
		url: (url ?? s.immichUrl).replace(/\/$/, ''),
		key: key ?? s.immichApiKey
	};
}

function headers(key: string): Record<string, string> {
	return { 'x-api-key': key, Accept: 'application/json' };
}

export async function testConnection(
	url: string,
	key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const b = base(url, key);
		if (!b.url) return { ok: false, error: 'Server URL is required.' };
		const res = await fetch(`${b.url}/api/users/me`, { headers: headers(b.key) });
		if (res.status === 401) return { ok: false, error: 'Invalid API key.' };
		if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export interface ImmichAlbum {
	id: string;
	albumName: string;
	assetCount: number;
}

export async function listAlbums(): Promise<ImmichAlbum[]> {
	const b = base();
	const res = await fetch(`${b.url}/api/albums`, { headers: headers(b.key) });
	if (!res.ok) throw new Error(`Immich returned HTTP ${res.status}`);
	const albums = (await res.json()) as Array<{
		id: string;
		albumName: string;
		assetCount?: number;
	}>;
	return albums.map((a) => ({
		id: a.id,
		albumName: a.albumName,
		assetCount: a.assetCount ?? 0
	}));
}

export interface ImmichAsset {
	id: string;
	originalFileName: string;
	type: string;
}

export async function listAlbumAssets(albumId: string): Promise<ImmichAsset[]> {
	const b = base();
	if (albumId) {
		const res = await fetch(`${b.url}/api/albums/${albumId}`, { headers: headers(b.key) });
		if (!res.ok) throw new Error(`Immich returned HTTP ${res.status}`);
		const album = (await res.json()) as { assets?: ImmichAsset[] };
		return (album.assets ?? []).filter((a) => a.type === 'IMAGE');
	}
	const res = await fetch(`${b.url}/api/search/metadata`, {
		method: 'POST',
		headers: { ...headers(b.key), 'Content-Type': 'application/json' },
		body: JSON.stringify({ type: 'IMAGE', size: 250, order: 'desc' })
	});
	if (!res.ok) throw new Error(`Immich returned HTTP ${res.status}`);
	const data = (await res.json()) as { assets?: { items?: ImmichAsset[] } };
	return (data.assets?.items ?? []).filter((a) => a.type === 'IMAGE');
}

export async function getAssetStream(
	assetId: string
): Promise<{ stream: Readable; contentType: string }> {
	const b = base();
	const res = await fetch(`${b.url}/api/assets/${assetId}/thumbnail?size=preview`, {
		headers: { 'x-api-key': b.key }
	});
	if (!res.ok || !res.body) throw new Error(`Immich returned HTTP ${res.status}`);
	const { Readable } = await import('node:stream');
	const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
	return { stream, contentType: res.headers.get('content-type') ?? 'image/jpeg' };
}

export async function uploadAsset(
	file: File,
	albumId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	const b = base();
	try {
		const form = new FormData();
		const now = new Date().toISOString();
		form.set('assetData', file, file.name);
		form.set('deviceAssetId', `pictureframe-${randomUUID()}`);
		form.set('deviceId', 'picture-frame');
		form.set('fileCreatedAt', now);
		form.set('fileModifiedAt', now);
		form.set('isFavorite', 'false');

		const res = await fetch(`${b.url}/api/assets`, {
			method: 'POST',
			headers: { 'x-api-key': b.key },
			body: form
		});
		if (!res.ok) return { ok: false, error: `Immich upload failed: HTTP ${res.status}` };
		const data = (await res.json()) as { id: string; status: string };

		if (albumId && data.id) {
			await fetch(`${b.url}/api/albums/${albumId}/assets`, {
				method: 'PUT',
				headers: { ...headers(b.key), 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: [data.id] })
			}).catch(() => {});
		}
		return { ok: true, id: data.id };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export async function removeFromAlbum(albumId: string, assetId: string): Promise<void> {
	const b = base();
	if (!albumId) return;
	await fetch(`${b.url}/api/albums/${albumId}/assets`, {
		method: 'DELETE',
		headers: { ...headers(b.key), 'Content-Type': 'application/json' },
		body: JSON.stringify({ ids: [assetId] })
	}).catch(() => {});
}
