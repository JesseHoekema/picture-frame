<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import type { PageData } from "./$types";

  import Cloud from "@lucide/svelte/icons/cloud";
  import CloudRain from "@lucide/svelte/icons/cloud-rain";
  import CloudSun from "@lucide/svelte/icons/cloud-sun";
  import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
  import CloudSnow from "@lucide/svelte/icons/cloud-snow";
  import Snowflake from "@lucide/svelte/icons/snowflake";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Wind from "@lucide/svelte/icons/wind";
  import ImageOff from "@lucide/svelte/icons/image-off";

  let { data }: { data: PageData } = $props();
  // svelte-ignore state_referenced_locally
  const s = data.settings;

  const ICONS: Record<string, typeof Cloud> = {
    "clear-night": Moon,
    cloudy: Cloud,
    fog: Cloud,
    partlycloudy: CloudSun,
    pouring: CloudRain,
    rainy: CloudRain,
    snowy: Snowflake,
    "snowy-rainy": CloudSnow,
    sunny: Sun,
    windy: Wind,
    "lightning-rainy": CloudLightning,
    lightning: CloudLightning,
  };

  // ----- slideshow (time-synchronized) -----
  // svelte-ignore state_referenced_locally
  const baseIds = data.images.map((i) => i.id);
  const durationMs = Math.max(2, s.slideDurationSec) * 1000;
  let clockOffset = 0;

  function syncedNow(): number {
    return Date.now() + clockOffset;
  }

  function mulberry32(seed: number) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(arr: string[], seed: number): string[] {
    const a = [...arr];
    const rand = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function idAtSlot(slot: number): string | null {
    const n = baseIds.length;
    if (n === 0) return null;
    const pos = ((slot % n) + n) % n;
    if (s.shuffle) {
      const cycle = Math.floor(slot / n);
      return seededShuffle(baseIds, cycle)[pos];
    }
    return baseIds[pos];
  }

  function currentSlot(): number {
    return Math.floor(syncedNow() / durationMs);
  }

  let currentId = $state<string | null>(idAtSlot(currentSlot()));

  function tick() {
    const id = idAtSlot(currentSlot());
    if (id !== currentId) {
      currentId = id;
      preloadNext();
    }
  }

  function preloadNext() {
    if (baseIds.length < 2) return;
    const nextId = idAtSlot(currentSlot() + 1);
    if (!nextId) return;
    const img = new Image();
    img.src = `/api/media/${nextId}`;
  }

  // ----- clock -----
  let now = $state(new Date());
  let clockText = $derived(
    now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: s.clockFormat === "12h",
    }),
  );

  // ----- live state (weather + motion) -----
  let weather = $state<{
    temperature: number | null;
    condition: string | null;
    unit: string;
  } | null>(null);
  let displayOn = $state(true);
  let sensors = $state<{ name: string; state: string; unit: string }[]>([]);
  let wakeLock: WakeLockSentinel | null = null;

  let tempText = $derived(
    weather && weather.temperature != null
      ? `${weather.temperature.toLocaleString(undefined, { maximumFractionDigits: 1 })}°`
      : null,
  );
  let WeatherIcon = $derived(
    weather?.condition ? (ICONS[weather.condition] ?? Cloud) : Cloud,
  );

  type LiveState = {
    weather: typeof weather;
    displayShouldBeOn?: boolean;
    sensors?: typeof sensors;
  };
  function applyLive(live: LiveState) {
    weather = live.weather;
    displayOn = live.displayShouldBeOn ?? true;
    sensors = live.sensors ?? [];
  }

  async function poll() {
    try {
      const res = await fetch("/api/frame/live");
      if (!res.ok) return;
      applyLive(await res.json());
    } catch {
      /* ignore */
    }
  }

  let es: EventSource | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let sseConnected = false;

  function startFallbackPolling() {
    if (fallbackTimer) return;
    poll();
    fallbackTimer = setInterval(poll, Math.max(2, s.pollIntervalSec) * 1000);
  }

  function startLive() {
    try {
      es = new EventSource("/api/frame/stream");
      es.onmessage = (e) => {
        sseConnected = true;
        try {
          applyLive(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (!sseConnected) startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator && displayOn) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      /* unavailable */
    }
  }

  onMount(() => {
    clockOffset = data.serverTime - Date.now();
    currentId = idAtSlot(currentSlot());
    preloadNext();
    const slide = setInterval(tick, 1000);
    const clock = setInterval(() => (now = new Date()), 1000);
    startLive();
    requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(slide);
      clearInterval(clock);
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock?.release().catch(() => {});
    };
  });
</script>

<svelte:head>
  <title>Picture Frame</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
  />
</svelte:head>

<div class="frame">
  {#if baseIds.length === 0}
    <div class="empty">
      <ImageOff size={64} strokeWidth={1.25} />
      <p>No pictures yet</p>
      <span>Add photos from the dashboard or a share link.</span>
    </div>
  {:else}
    {#key currentId}
      <img
        class="photo"
        style:object-fit={s.fit}
        src={`/api/media/${currentId}`}
        alt=""
        transition:fade={{ duration: s.transition === "none" ? 0 : 900 }}
      />
    {/key}
  {/if}

  <div class="scrim"></div>

  {#if s.showClock || s.showWeather}
    <div class="overlay">
      {#if s.showClock}
        <div class="clock">{clockText}</div>
      {/if}
      {#if s.showWeather && (tempText || weather)}
        <div class="weather">
          {#if tempText}<span class="temp">{tempText}</span>{/if}
          <WeatherIcon class="wicon" size={40} strokeWidth={1.5} />
        </div>
      {/if}
    </div>
  {/if}

  {#if sensors.length > 0}
    <div class="sensors">
      {#each sensors as sensor (sensor.name)}
        <div class="sensor">
          <span class="sval">{sensor.state}{sensor.unit}</span>
          <span class="sname">{sensor.name}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if !displayOn}
    <div class="sleep" transition:fade={{ duration: 600 }}></div>
  {/if}
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: #000;
    overflow: hidden;
    cursor: none;
  }
  :global(*) {
    cursor: none !important;
  }
  .frame {
    position: fixed;
    inset: 0;
    background: #000;
    cursor: none;
  }
  .photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.55),
      rgba(0, 0, 0, 0) 40%
    );
    pointer-events: none;
  }
  .overlay {
    position: absolute;
    right: clamp(1rem, 2.5vw, 2.5rem);
    bottom: clamp(1.25rem, 4vh, 3rem);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: clamp(0.5rem, 1.5vw, 1rem);
    color: #fff;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    font-family:
      system-ui,
      -apple-system,
      "Segoe UI",
      Roboto,
      sans-serif;
  }
  .weather {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .temp {
    font-size: clamp(1.2rem, 2.8vw, 2.1rem);
    font-weight: 300;
  }
  .overlay :global(.wicon) {
    opacity: 0.95;
  }
  .clock {
    font-size: clamp(2.75rem, 8vw, 7rem);
    font-weight: 200;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .sleep {
    position: absolute;
    inset: 0;
    background: #000;
  }
  .sensors {
    position: absolute;
    left: clamp(1rem, 2.5vw, 2.5rem);
    bottom: clamp(1.25rem, 4vh, 3rem);
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: clamp(0.75rem, 2vw, 1.75rem);
    color: #fff;
    text-align: left;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    font-family:
      system-ui,
      -apple-system,
      "Segoe UI",
      Roboto,
      sans-serif;
  }
  .sensor {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }
  .sval {
    font-size: clamp(1.25rem, 2.8vw, 2.25rem);
    font-weight: 300;
  }
  .sname {
    font-size: clamp(0.7rem, 1.2vw, 0.95rem);
    opacity: 0.8;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #6b7280;
    font-family: system-ui, sans-serif;
  }
  .empty p {
    margin: 0.5rem 0 0;
    font-size: 1.5rem;
    color: #9ca3af;
  }
  .empty span {
    font-size: 0.95rem;
  }
</style>
