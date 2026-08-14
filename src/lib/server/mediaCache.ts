import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

const CACHE_DIR = process.env.MEDIA_CACHE_DIR ?? 'data/cache';
const MAX_MEM_ENTRIES = 30;
const MAX_MEM_BYTES = 150 * 1024 * 1024;
const MAX_DISK_FILES = 2000;

export interface CachedMedia {
	buffer: Buffer;
	contentType: string;
}

// ---- in-memory LRU ----
const mem = new Map<string, CachedMedia>();
let memBytes = 0;

function memGet(key: string): CachedMedia | undefined {
	const e = mem.get(key);
	if (e) {
		mem.delete(key);
		mem.set(key, e);
	}
	return e;
}

function memPut(key: string, entry: CachedMedia) {
	const existing = mem.get(key);
	if (existing) {
		memBytes -= existing.buffer.length;
		mem.delete(key);
	}
	mem.set(key, entry);
	memBytes += entry.buffer.length;
	while (mem.size > MAX_MEM_ENTRIES || memBytes > MAX_MEM_BYTES) {
		const oldest = mem.keys().next().value as string | undefined;
		if (oldest === undefined) break;
		const ev = mem.get(oldest);
		if (ev) memBytes -= ev.buffer.length;
		mem.delete(oldest);
	}
}

// ---- on-disk cache ----
function fileFor(key: string): string {
	return join(CACHE_DIR, createHash('sha1').update(key).digest('hex'));
}

export async function readCache(key: string): Promise<CachedMedia | null> {
	const hot = memGet(key);
	if (hot) return hot;

	const file = fileFor(key);
	if (!existsSync(file)) return null;
	try {
		const [buffer, type] = await Promise.all([
			readFile(file),
			readFile(`${file}.type`, 'utf8').catch(() => 'application/octet-stream')
		]);
		const entry = { buffer, contentType: type };
		memPut(key, entry);
		return entry;
	} catch {
		return null;
	}
}

export async function writeCache(key: string, buffer: Buffer, contentType: string): Promise<void> {
	memPut(key, { buffer, contentType });
	const file = fileFor(key);
	try {
		await mkdir(CACHE_DIR, { recursive: true });
		await Promise.all([writeFile(file, buffer), writeFile(`${file}.type`, contentType)]);
		void evictDiskIfNeeded();
	} catch {
		/* best-effort */
	}
}

export async function invalidate(key: string): Promise<void> {
	const existing = mem.get(key);
	if (existing) {
		memBytes -= existing.buffer.length;
		mem.delete(key);
	}
	const file = fileFor(key);
	await unlink(file).catch(() => {});
	await unlink(`${file}.type`).catch(() => {});
}

export async function clearAll(): Promise<void> {
	mem.clear();
	memBytes = 0;
	try {
		const names = await readdir(CACHE_DIR);
		await Promise.all(names.map((n) => unlink(join(CACHE_DIR, n)).catch(() => {})));
	} catch {
		/* nothing to clear */
	}
}

async function evictDiskIfNeeded(): Promise<void> {
	try {
		const names = (await readdir(CACHE_DIR)).filter((n) => !n.endsWith('.type'));
		if (names.length <= MAX_DISK_FILES) return;
		const withTime = await Promise.all(
			names.map(async (n) => {
				const s = await stat(join(CACHE_DIR, n)).catch(() => null);
				return { n, t: s ? s.mtimeMs : 0 };
			})
		);
		withTime.sort((a, b) => a.t - b.t);
		const remove = withTime.slice(0, withTime.length - MAX_DISK_FILES);
		await Promise.all(
			remove.flatMap(({ n }) => [
				unlink(join(CACHE_DIR, n)).catch(() => {}),
				unlink(join(CACHE_DIR, `${n}.type`)).catch(() => {})
			])
		);
	} catch {
		/* ignore */
	}
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}
