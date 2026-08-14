import { getSettings } from './settings';

const ICON_TO_CONDITION: Record<string, string> = {
	'01d': 'sunny',
	'01n': 'clear-night',
	'02d': 'partlycloudy',
	'02n': 'partlycloudy',
	'03d': 'cloudy',
	'03n': 'cloudy',
	'04d': 'cloudy',
	'04n': 'cloudy',
	'09d': 'rainy',
	'09n': 'rainy',
	'10d': 'pouring',
	'10n': 'pouring',
	'11d': 'lightning-rainy',
	'11n': 'lightning-rainy',
	'13d': 'snowy',
	'13n': 'snowy',
	'50d': 'fog',
	'50n': 'fog'
};

function locationParams(location: string): string {
	const trimmed = location.trim();
	const parts = trimmed.split(',').map((p) => p.trim());
	if (parts.length === 2 && parts.every((p) => p !== '' && !Number.isNaN(Number(p)))) {
		return `lat=${encodeURIComponent(parts[0])}&lon=${encodeURIComponent(parts[1])}`;
	}
	return `q=${encodeURIComponent(trimmed)}`;
}

export async function fetchWeather(): Promise<{
	temperature: number | null;
	condition: string | null;
	unit: string;
} | null> {
	const s = getSettings();
	if (!s.owmApiKey || !s.owmLocation) return null;
	const unitSymbol = s.owmUnits === 'imperial' ? '°F' : '°C';
	const url = `https://api.openweathermap.org/data/2.5/weather?${locationParams(
		s.owmLocation
	)}&units=${s.owmUnits}&appid=${encodeURIComponent(s.owmApiKey)}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`OpenWeatherMap HTTP ${res.status}`);
	const data = (await res.json()) as {
		main?: { temp?: number };
		weather?: Array<{ icon?: string; main?: string }>;
	};
	const icon = data.weather?.[0]?.icon ?? '';
	return {
		temperature: typeof data.main?.temp === 'number' ? data.main.temp : null,
		condition: ICON_TO_CONDITION[icon] ?? data.weather?.[0]?.main?.toLowerCase() ?? null,
		unit: unitSymbol
	};
}

export async function testConnection(
	apiKey: string,
	location: string,
	units: 'metric' | 'imperial'
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const url = `https://api.openweathermap.org/data/2.5/weather?${locationParams(
			location
		)}&units=${units}&appid=${encodeURIComponent(apiKey)}`;
		const res = await fetch(url);
		if (res.status === 401) return { ok: false, error: 'Invalid API key.' };
		if (res.status === 404) return { ok: false, error: 'Location not found.' };
		if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
