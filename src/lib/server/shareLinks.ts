import { randomBytes } from 'node:crypto';
import { db, type ShareLinkRow } from './db';
import { hashPassword, verifyPassword } from './auth';

export function listShareLinks(): ShareLinkRow[] {
	return db.prepare('SELECT * FROM share_links ORDER BY created_at DESC').all() as ShareLinkRow[];
}

export function getShareLinkByToken(token: string): ShareLinkRow | undefined {
	return db.prepare('SELECT * FROM share_links WHERE token = ?').get(token) as
		| ShareLinkRow
		| undefined;
}

export function createShareLink(name: string, password?: string): ShareLinkRow {
	const token = randomBytes(9).toString('base64url');
	const info = db
		.prepare(
			'INSERT INTO share_links (token, name, password_hash, enabled, created_at) VALUES (?, ?, ?, 1, ?)'
		)
		.run(token, name, password ? hashPassword(password) : null, Date.now());
	return db.prepare('SELECT * FROM share_links WHERE id = ?').get(info.lastInsertRowid) as ShareLinkRow;
}

export function setShareLinkEnabled(id: number, enabled: boolean): void {
	db.prepare('UPDATE share_links SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

export function updateShareLinkPassword(id: number, password: string | null): void {
	db.prepare('UPDATE share_links SET password_hash = ? WHERE id = ?').run(
		password ? hashPassword(password) : null,
		id
	);
}

export function deleteShareLink(id: number): void {
	db.prepare('DELETE FROM share_links WHERE id = ?').run(id);
}

export function checkShareLinkPassword(link: ShareLinkRow, password: string): boolean {
	if (!link.password_hash) return true;
	return verifyPassword(password, link.password_hash);
}
