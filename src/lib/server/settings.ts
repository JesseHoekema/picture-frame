import { db } from './db';

export type StorageBackend = 'local' | 'minio' | 'immich';

export interface Settings {
	// Storage backend selection
	storageBackend: StorageBackend;
	// MinIO
	minioEndpoint: string;
	minioPort: number;
	minioUseSSL: boolean;
	minioAccessKey: string;
	minioSecretKey: string;
	minioBucket: string;
	// Immich
	immichUrl: string;
	immichApiKey: string;
	immichAlbumId: string;
	// Slideshow
	slideDurationSec: number;
	shuffle: boolean;
	transition: 'fade' | 'slide' | 'none';
	fit: 'cover' | 'contain';
	// Clock & weather overlay
	showClock: boolean;
	showWeather: boolean;
	clockFormat: '24h' | '12h';
	weatherSource: 'ha' | 'openweathermap';
	owmApiKey: string;
	owmLocation: string;
	owmUnits: 'metric' | 'imperial';
	// Home Assistant
	haUrl: string;
	haToken: string;
	haMotionEntity: string;
	haWeatherEntity: string;
	haDisplayEntity: string;
	frameSensors: string[];
	// Motion / display power management
	motionEnabled: boolean;
	motionTimeoutSec: number;
	screenLightEnabled: boolean;
	screenLightEntity: string;
	screenPower: boolean;
	pollIntervalSec: number;
}

export const DEFAULT_SETTINGS: Settings = {
	storageBackend: 'local',
	minioEndpoint: '',
	minioPort: 9000,
	minioUseSSL: false,
	minioAccessKey: '',
	minioSecretKey: '',
	minioBucket: 'picture-frame',
	immichUrl: '',
	immichApiKey: '',
	immichAlbumId: '',
	slideDurationSec: 10,
	shuffle: false,
	transition: 'fade',
	fit: 'cover',
	showClock: true,
	showWeather: true,
	clockFormat: '24h',
	weatherSource: 'ha',
	owmApiKey: '',
	owmLocation: '',
	owmUnits: 'metric',
	haUrl: '',
	haToken: '',
	haMotionEntity: '',
	haWeatherEntity: '',
	haDisplayEntity: '',
	frameSensors: [],
	motionEnabled: false,
	motionTimeoutSec: 300,
	screenLightEnabled: false,
	screenLightEntity: '',
	screenPower: true,
	pollIntervalSec: 15
};

export function getSettings(): Settings {
	const rows = db.prepare('SELECT key, value FROM settings').all() as {
		key: string;
		value: string;
	}[];
	const stored: Record<string, unknown> = {};
	for (const row of rows) {
		try {
			stored[row.key] = JSON.parse(row.value);
		} catch {
			stored[row.key] = row.value;
		}
	}
	return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export function updateSettings(patch: Partial<Settings>): void {
	const stmt = db.prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	);
	const tx = db.transaction((entries: [string, unknown][]) => {
		for (const [key, value] of entries) {
			stmt.run(key, JSON.stringify(value));
		}
	});
	tx(Object.entries(patch));
}

export function getPublicFrameSettings() {
	const s = getSettings();
	return {
		slideDurationSec: s.slideDurationSec,
		shuffle: s.shuffle,
		transition: s.transition,
		fit: s.fit,
		showClock: s.showClock,
		showWeather: s.showWeather,
		clockFormat: s.clockFormat,
		motionEnabled: s.motionEnabled,
		motionTimeoutSec: s.motionTimeoutSec,
		pollIntervalSec: s.pollIntervalSec,
		hasWeather:
			s.showWeather &&
			((s.weatherSource === 'ha' && !!s.haUrl && !!s.haWeatherEntity) ||
				(s.weatherSource === 'openweathermap' && !!s.owmApiKey && !!s.owmLocation))
	};
}

export function isMinioConfigured(): boolean {
	const s = getSettings();
	return !!(s.minioEndpoint && s.minioAccessKey && s.minioSecretKey && s.minioBucket);
}

export function isStorageConfigured(): boolean {
	const s = getSettings();
	switch (s.storageBackend) {
		case 'local':
			return true;
		case 'minio':
			return isMinioConfigured();
		case 'immich':
			return !!(s.immichUrl && s.immichApiKey);
		default:
			return false;
	}
}
