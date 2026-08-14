import { Client } from 'minio';
import { getSettings, type Settings } from './settings';

export function normalizeEndpoint(
	endpointInput: string,
	portInput: number,
	sslInput: boolean
): { endpoint: string; port: number; useSSL: boolean } {
	let endpoint = endpointInput.trim();
	let useSSL = sslInput;
	let port = portInput;
	if (/^https?:\/\//i.test(endpoint)) {
		try {
			const u = new URL(endpoint);
			useSSL = u.protocol === 'https:';
			endpoint = u.hostname;
			if (u.port) port = Number(u.port);
			else if (!portInput || portInput === 9000) port = useSSL ? 443 : 80;
		} catch {
			/* leave as typed */
		}
	}
	endpoint = endpoint.replace(/\/.*$/, '');
	return { endpoint, port, useSSL };
}

export function makeClient(s: Settings): Client {
	return new Client({
		endPoint: s.minioEndpoint,
		port: s.minioPort,
		useSSL: s.minioUseSSL,
		accessKey: s.minioAccessKey,
		secretKey: s.minioSecretKey
	});
}

export function getClient(): { client: Client; bucket: string } {
	const s = getSettings();
	return { client: makeClient(s), bucket: s.minioBucket };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		p,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), ms))
	]);
}

async function tryEnsureBucket(
	s: Settings
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const client = makeClient(s);
		const exists = await withTimeout(client.bucketExists(s.minioBucket), 8000);
		if (!exists) {
			await withTimeout(client.makeBucket(s.minioBucket), 8000);
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

function isProtocolMismatch(error: string): boolean {
	return /wrong version number|EPROTO|ECONNRESET|routines|socket hang up|139\d{9}|packet length too long/i.test(
		error
	);
}

export async function testAndEnsureBucket(
	s: Settings
): Promise<{ ok: true; useSSL: boolean } | { ok: false; error: string }> {
	const first = await tryEnsureBucket(s);
	if (first.ok) return { ok: true, useSSL: s.minioUseSSL };

	if (isProtocolMismatch(first.error)) {
		const flipped = { ...s, minioUseSSL: !s.minioUseSSL };
		const second = await tryEnsureBucket(flipped);
		if (second.ok) return { ok: true, useSSL: flipped.minioUseSSL };
	}
	return { ok: false, error: first.error };
}

export async function putObject(
	key: string,
	buffer: Buffer,
	contentType: string
): Promise<void> {
	const { client, bucket } = getClient();
	await client.putObject(bucket, key, buffer, buffer.length, {
		'Content-Type': contentType
	});
}

export async function getObjectStream(key: string) {
	const { client, bucket } = getClient();
	return client.getObject(bucket, key);
}

export async function statObject(key: string) {
	const { client, bucket } = getClient();
	return client.statObject(bucket, key);
}

export async function removeObject(key: string): Promise<void> {
	const { client, bucket } = getClient();
	await client.removeObject(bucket, key);
}
