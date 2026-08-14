import { readFileSync } from 'node:fs';
import os from 'node:os';

export interface SystemStats {
	isPi: boolean;
	model: string | null;
	hostname: string;
	cpuTempC: number | null;
	load1: number;
	cpuCount: number;
	memTotal: number;
	memUsed: number;
	memUsedPct: number;
	uptimeSec: number;
}

let cachedModel: string | null | undefined;

function deviceModel(): string | null {
	if (cachedModel !== undefined) return cachedModel;
	try {
		cachedModel = readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '').trim();
	} catch {
		try {
			const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8');
			const m = cpuinfo.match(/^Model\s*:\s*(.+)$/m);
			cachedModel = m ? m[1].trim() : null;
		} catch {
			cachedModel = null;
		}
	}
	return cachedModel;
}

export function isRaspberryPi(): boolean {
	const m = deviceModel();
	return !!m && /raspberry pi/i.test(m);
}

function cpuTemp(): number | null {
	try {
		const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
		const value = Number(raw);
		if (!Number.isFinite(value)) return null;
		return Math.round(value / 100) / 10;
	} catch {
		return null;
	}
}

export function getSystemStats(): SystemStats {
	const memTotal = os.totalmem();
	const memFree = os.freemem();
	const memUsed = memTotal - memFree;
	return {
		isPi: isRaspberryPi(),
		model: deviceModel(),
		hostname: os.hostname(),
		cpuTempC: cpuTemp(),
		load1: os.loadavg()[0],
		cpuCount: os.cpus().length,
		memTotal,
		memUsed,
		memUsedPct: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0,
		uptimeSec: os.uptime()
	};
}
