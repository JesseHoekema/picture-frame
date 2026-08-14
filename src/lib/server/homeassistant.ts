import { getSettings } from './settings';

export interface HAState {
	entity_id: string;
	state: string;
	attributes: Record<string, unknown>;
	last_changed: string;
}

function base() {
	const s = getSettings();
	return { url: s.haUrl.replace(/\/$/, ''), token: s.haToken };
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
	const { url, token } = base();
	if (!url || !token) throw new Error('Home Assistant is not configured.');
	return fetch(`${url}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...(init?.headers ?? {})
		}
	});
}

export async function testConnection(
	url: string,
	token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch(`${url.replace(/\/$/, '')}/api/`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export async function getStates(): Promise<HAState[]> {
	const res = await haFetch('/api/states');
	if (!res.ok) throw new Error(`Home Assistant returned HTTP ${res.status}`);
	return (await res.json()) as HAState[];
}

export async function getState(entityId: string): Promise<HAState | null> {
	if (!entityId) return null;
	const res = await haFetch(`/api/states/${encodeURIComponent(entityId)}`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Home Assistant returned HTTP ${res.status}`);
	return (await res.json()) as HAState;
}

export async function callService(
	domain: string,
	service: string,
	entityId: string
): Promise<void> {
	const res = await haFetch(`/api/services/${domain}/${service}`, {
		method: 'POST',
		body: JSON.stringify({ entity_id: entityId })
	});
	if (!res.ok) throw new Error(`Service call failed: HTTP ${res.status}`);
}

export async function setDisplayPower(on: boolean): Promise<void> {
	const s = getSettings();
	if (!s.haDisplayEntity) return;
	const domain = s.haDisplayEntity.split('.')[0];
	const service = on ? 'turn_on' : 'turn_off';
	await callService(domain, service, s.haDisplayEntity);
}
