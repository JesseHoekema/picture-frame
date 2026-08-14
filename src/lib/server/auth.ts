import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, type UserRow } from './db';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const SESSION_COOKIE = 'pf_session';

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const derived = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, key] = stored.split(':');
	if (!salt || !key) return false;
	const derived = scryptSync(password, salt, 64);
	const keyBuf = Buffer.from(key, 'hex');
	if (keyBuf.length !== derived.length) return false;
	return timingSafeEqual(keyBuf, derived);
}

export function hasUsers(): boolean {
	const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
	return row.c > 0;
}

export function createUser(username: string, password: string): UserRow {
	const info = db
		.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
		.run(username, hashPassword(password), Date.now());
	return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
}

export function getUserByUsername(username: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function updateUsername(id: number, username: string): void {
	db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
}

export function updatePassword(id: number, password: string): void {
	db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
}

export function createSession(userId: number): string {
	const id = randomBytes(24).toString('hex');
	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		id,
		userId,
		Date.now() + SESSION_TTL_MS
	);
	return id;
}

export function getSessionUser(sessionId: string | undefined): UserRow | null {
	if (!sessionId) return null;
	const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as
		| { id: string; user_id: number; expires_at: number }
		| undefined;
	if (!session) return null;
	if (session.expires_at < Date.now()) {
		db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
		return null;
	}
	return db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as UserRow | null;
}

export function deleteSession(sessionId: string): void {
	db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
