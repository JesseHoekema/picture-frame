import { getSettings } from './settings';
import { getState, setDisplayPower } from './homeassistant';
import { fetchWeather } from './openweather';

export interface FrameLiveState {
	weather: { temperature: number | null; condition: string | null; unit: string } | null;
	motion: { enabled: boolean; active: boolean; secondsSinceMotion: number | null } | null;
	sensors: { name: string; state: string; unit: string }[];
	displayShouldBeOn: boolean;
}

let lastPushedOn: boolean | null = null;

const WEATHER_ICON: Record<string, string> = {
	'clear-night': 'moon',
	cloudy: 'cloud',
	fog: 'cloud',
	hail: 'cloud-hail',
	lightning: 'cloud-lightning',
	'lightning-rainy': 'cloud-lightning',
	partlycloudy: 'cloud-sun',
	pouring: 'cloud-rain',
	rainy: 'cloud-rain',
	snowy: 'snowflake',
	'snowy-rainy': 'cloud-snow',
	sunny: 'sun',
	windy: 'wind',
	'windy-variant': 'wind',
	exceptional: 'triangle-alert'
};

export function weatherIcon(condition: string | null): string {
	if (!condition) return 'cloud';
	return WEATHER_ICON[condition] ?? 'cloud';
}

export async function computeFrameLiveState(): Promise<FrameLiveState> {
	const s = getSettings();
	const result: FrameLiveState = { weather: null, motion: null, sensors: [], displayShouldBeOn: true };

	if (s.haUrl && s.haToken && s.frameSensors.length > 0) {
		const states = await Promise.all(
			s.frameSensors.map((id) => getState(id).catch(() => null))
		);
		result.sensors = states
			.filter((st): st is NonNullable<typeof st> => !!st)
			.map((st) => {
				const attrs = st.attributes as Record<string, unknown>;
				return {
					name: (attrs.friendly_name as string) ?? st.entity_id,
					state: st.state,
					unit: (attrs.unit_of_measurement as string) ?? ''
				};
			});
	}

	if (s.showWeather) {
		try {
			if (s.weatherSource === 'openweathermap' && s.owmApiKey && s.owmLocation) {
				result.weather = await fetchWeather();
			} else if (s.haUrl && s.haToken && s.haWeatherEntity) {
				const state = await getState(s.haWeatherEntity);
				if (state) {
					const attrs = state.attributes as Record<string, unknown>;
					result.weather = {
						temperature: typeof attrs.temperature === 'number' ? attrs.temperature : null,
						condition: state.state,
						unit: (attrs.temperature_unit as string) ?? '°'
					};
				}
			}
		} catch {
			/* leave weather null */
		}
	}

	const votes: boolean[] = [];
	const haReady = !!(s.haUrl && s.haToken);

	if (haReady && s.motionEnabled && s.haMotionEntity) {
		try {
			const state = await getState(s.haMotionEntity);
			if (state) {
				const active = state.state === 'on';
				const since = (Date.now() - new Date(state.last_changed).getTime()) / 1000;
				const secondsSinceMotion = active ? 0 : since;
				const on = active || secondsSinceMotion < s.motionTimeoutSec;
				result.motion = { enabled: true, active, secondsSinceMotion };
				votes.push(on);
			}
		} catch {
			result.motion = { enabled: true, active: false, secondsSinceMotion: null };
		}
	}

	if (haReady && s.screenLightEnabled && s.screenLightEntity) {
		try {
			const state = await getState(s.screenLightEntity);
			if (state) votes.push(state.state === 'on');
		} catch {
			votes.push(true);
		}
	}

	let shouldBeOn: boolean;
	if (!s.screenPower) {
		shouldBeOn = false;
	} else if (votes.length > 0) {
		shouldBeOn = votes.some((v) => v);
	} else {
		shouldBeOn = true;
	}
	result.displayShouldBeOn = shouldBeOn;

	if (s.haDisplayEntity && shouldBeOn !== lastPushedOn) {
		lastPushedOn = shouldBeOn;
		setDisplayPower(shouldBeOn).catch(() => {});
	}

	return result;
}
