import { randomBytes } from 'node:crypto';
import { db, type ImageRow } from './db';
import * as storage from './storage';
import * as immich from './immich';
import { getSettings } from './settings';
import { invalidate as invalidateCache } from './mediaCache';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const MAX_SIZE = 50 * 1024 * 1024;

export interface FrameImage {
	id: string;
	original_name: string | null;
	source: string;
	position: number;
}

export async function listImages(): Promise<FrameImage[]> {
	const s = getSettings();
	if (s.storageBackend === 'immich') {
		try {
			const assets = await immich.listAlbumAssets(s.immichAlbumId);
			return assets.map((a, i) => ({
				id: `immich:${a.id}`,
				original_name: a.originalFileName,
				source: 'immich',
				position: i
			}));
		} catch {
			return [];
		}
	}
	const rows = db
		.prepare('SELECT * FROM images WHERE backend = ? ORDER BY position ASC, id ASC')
		.all(s.storageBackend) as ImageRow[];
	return rows.map((r) => ({
		id: String(r.id),
		original_name: r.original_name,
		source: r.source,
		position: r.position
	}));
}

export function getImage(id: number): ImageRow | undefined {
	return db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined;
}

function extFor(contentType: string, name: string): string {
	const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
	if (fromName && fromName.length <= 5) return fromName;
	const map: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/avif': 'avif'
	};
	return map[contentType] ?? 'bin';
}

export async function saveUpload(
	file: File,
	source: 'admin' | 'share',
	shareLinkId: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
	const contentType = file.type || 'application/octet-stream';
	if (!ALLOWED.has(contentType)) {
		return { ok: false, error: `Unsupported file type: ${contentType}` };
	}
	if (file.size > MAX_SIZE) {
		return { ok: false, error: 'File is too large (max 50 MB).' };
	}

	const s = getSettings();

	if (s.storageBackend === 'immich') {
		const res = await immich.uploadAsset(file, s.immichAlbumId);
		if (!res.ok) return res;
		if (shareLinkId != null) {
			db.prepare('UPDATE share_links SET upload_count = upload_count + 1 WHERE id = ?').run(
				shareLinkId
			);
		}
		return { ok: true };
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const key = `${Date.now()}-${randomBytes(6).toString('hex')}.${extFor(contentType, file.name)}`;
	try {
		await storage.putObject(key, buffer, contentType);
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Upload to storage failed.' };
	}

	const maxPos = db
		.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM images WHERE backend = ?')
		.get(s.storageBackend) as { m: number };
	db.prepare(
		`INSERT INTO images (object_key, original_name, content_type, size, position, source, share_link_id, backend, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		key,
		file.name,
		contentType,
		file.size,
		maxPos.m + 1,
		source,
		shareLinkId,
		s.storageBackend,
		Date.now()
	);
	if (shareLinkId != null) {
		db.prepare('UPDATE share_links SET upload_count = upload_count + 1 WHERE id = ?').run(
			shareLinkId
		);
	}
	return { ok: true };
}

export async function deleteImage(id: string): Promise<void> {
	if (id.startsWith('immich:')) {
		const assetId = id.slice('immich:'.length);
		await immich.removeFromAlbum(getSettings().immichAlbumId, assetId);
		await invalidateCache(id);
		return;
	}
	const numeric = Number(id);
	const image = getImage(numeric);
	if (!image) return;
	await storage.removeObject(image.object_key);
	await invalidateCache(image.object_key);
	db.prepare('DELETE FROM images WHERE id = ?').run(numeric);
}

export function reorderImages(orderedIds: number[]): void {
	const stmt = db.prepare('UPDATE images SET position = ? WHERE id = ?');
	const tx = db.transaction((ids: number[]) => {
		ids.forEach((id, index) => stmt.run(index, id));
	});
	tx(orderedIds);
}
