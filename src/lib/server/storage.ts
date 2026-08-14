import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { Readable } from 'node:stream';
import { getSettings, type Settings } from './settings';
import * as minio from './minio';

const LOCAL_DIR = process.env.UPLOAD_DIR ?? 'data/uploads';

export function localPath(key: string): string {
	return join(LOCAL_DIR, key);
}

export async function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
	const s = getSettings();
	if (s.storageBackend === 'minio') {
		await minio.putObject(key, buffer, contentType);
		return;
	}
	const path = localPath(key);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, buffer);
}

export async function getObjectStream(
	key: string,
	contentType: string | null
): Promise<{ stream: Readable; contentType: string }> {
	const s = getSettings();
	if (s.storageBackend === 'minio') {
		const stream = (await minio.getObjectStream(key)) as unknown as Readable;
		return { stream, contentType: contentType ?? 'application/octet-stream' };
	}
	const path = localPath(key);
	if (!existsSync(path)) throw new Error('File not found');
	return { stream: createReadStream(path), contentType: contentType ?? 'application/octet-stream' };
}

export async function removeObject(key: string): Promise<void> {
	const s = getSettings();
	if (s.storageBackend === 'minio') {
		await minio.removeObject(key).catch(() => {});
		return;
	}
	await unlink(localPath(key)).catch(() => {});
}

export async function testBackend(
	patch: Partial<Settings>
): Promise<{ ok: true; useSSL?: boolean } | { ok: false; error: string }> {
	const backend = patch.storageBackend;
	if (backend === 'local') {
		try {
			await mkdir(LOCAL_DIR, { recursive: true });
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
	if (backend === 'minio') {
		return minio.testAndEnsureBucket({ ...getSettings(), ...patch } as Settings);
	}
	return { ok: true };
}
