import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getImage } from '$lib/server/images';
import * as storage from '$lib/server/storage';
import * as immich from '$lib/server/immich';
import { getSettings } from '$lib/server/settings';
import { readCache, writeCache, streamToBuffer } from '$lib/server/mediaCache';

const IMMUTABLE = 'public, max-age=604800, immutable';

function buffered(buffer: Buffer, contentType: string, hit: boolean): Response {
	return new Response(new Uint8Array(buffer), {
		headers: {
			'content-type': contentType,
			'content-length': String(buffer.length),
			'cache-control': IMMUTABLE,
			'x-cache': hit ? 'HIT' : 'MISS'
		}
	});
}

export const GET: RequestHandler = async ({ params }) => {
	const raw = params.id;
	const backend = getSettings().storageBackend;

	// Immich
	if (raw.startsWith('immich:')) {
		const cached = await readCache(raw);
		if (cached) return buffered(cached.buffer, cached.contentType, true);
		try {
			const { stream, contentType } = await immich.getAssetStream(raw.slice('immich:'.length));
			const buffer = await streamToBuffer(stream);
			await writeCache(raw, buffer, contentType);
			return buffered(buffer, contentType, false);
		} catch {
			throw error(502, 'Immich unavailable');
		}
	}

	const id = Number(raw);
	if (!Number.isFinite(id)) throw error(400, 'Invalid id');
	const image = getImage(id);
	if (!image) throw error(404, 'Not found');
	const contentType = image.content_type ?? 'application/octet-stream';

	// Local
	if (backend === 'local') {
		try {
			const { stream } = await storage.getObjectStream(image.object_key, contentType);
			const webStream = new ReadableStream({
				start(controller) {
					stream.on('data', (c: Buffer) => controller.enqueue(new Uint8Array(c)));
					stream.on('end', () => controller.close());
					stream.on('error', (e: Error) => controller.error(e));
				},
				cancel() {
					stream.destroy();
				}
			});
			return new Response(webStream, {
				headers: { 'content-type': contentType, 'cache-control': IMMUTABLE }
			});
		} catch {
			throw error(502, 'Storage unavailable');
		}
	}

	// MinIO / S3
	const cacheKey = image.object_key;
	const cached = await readCache(cacheKey);
	if (cached) return buffered(cached.buffer, cached.contentType, true);
	try {
		const { stream } = await storage.getObjectStream(image.object_key, contentType);
		const buffer = await streamToBuffer(stream);
		await writeCache(cacheKey, buffer, contentType);
		return buffered(buffer, contentType, false);
	} catch {
		throw error(502, 'Storage unavailable');
	}
};
