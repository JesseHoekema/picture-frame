import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DATABASE_PATH ?? 'data/picture-frame.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_links (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	token TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	password_hash TEXT,
	enabled INTEGER NOT NULL DEFAULT 1,
	upload_count INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	object_key TEXT NOT NULL UNIQUE,
	original_name TEXT,
	content_type TEXT,
	size INTEGER,
	position INTEGER NOT NULL,
	source TEXT NOT NULL DEFAULT 'admin',
	share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_images_position ON images(position);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// --- migrations ---
const imageCols = db.prepare('PRAGMA table_info(images)').all() as { name: string }[];
if (!imageCols.some((c) => c.name === 'backend')) {
	db.exec(`ALTER TABLE images ADD COLUMN backend TEXT NOT NULL DEFAULT ''`);
	const endpointRow = db
		.prepare("SELECT value FROM settings WHERE key = 'minioEndpoint'")
		.get() as { value: string } | undefined;
	let legacyBackend = 'local';
	try {
		if (endpointRow && JSON.parse(endpointRow.value)) legacyBackend = 'minio';
	} catch {
		/* leave as local */
	}
	db.prepare("UPDATE images SET backend = ? WHERE backend = ''").run(legacyBackend);
	db.exec('CREATE INDEX IF NOT EXISTS idx_images_backend ON images(backend)');
}

export interface UserRow {
	id: number;
	username: string;
	password_hash: string;
	created_at: number;
}

export interface ShareLinkRow {
	id: number;
	token: string;
	name: string;
	password_hash: string | null;
	enabled: number;
	upload_count: number;
	created_at: number;
}

export interface ImageRow {
	id: number;
	object_key: string;
	original_name: string | null;
	content_type: string | null;
	size: number | null;
	position: number;
	source: string;
	share_link_id: number | null;
	backend: string;
	created_at: number;
}
