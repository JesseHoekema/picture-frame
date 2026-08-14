<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Card from "$lib/components/ui/card";
  import * as Field from "$lib/components/ui/field";
  import * as Select from "$lib/components/ui/select";
  import * as Alert from "$lib/components/ui/alert";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import EntityCombobox from "$lib/components/EntityCombobox.svelte";
  import MultiEntityCombobox from "$lib/components/MultiEntityCombobox.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import { Separator } from "$lib/components/ui/separator";
  import { Spinner } from "$lib/components/ui/spinner";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";
  import type { SubmitFunction } from "@sveltejs/kit";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Info from "@lucide/svelte/icons/info";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import Database from "@lucide/svelte/icons/database";
  import Cloud from "@lucide/svelte/icons/cloud";

  let { data }: { data: PageData } = $props();

  // Animated tab bar
  const tabs = [
    { value: "slideshow", label: "Slideshow" },
    { value: "overlay", label: "Clock & weather" },
    { value: "storage", label: "Storage" },
    { value: "ha", label: "Home Assistant" },
    { value: "account", label: "Account" },
  ];
  const tabValues = new Set(tabs.map((t) => t.value));
  let tab = $state("slideshow");
  let btnEls = $state<Record<string, HTMLButtonElement | undefined>>({});
  let indicator = $state({ left: 0, width: 0 });
  function updateIndicator() {
    const el = btnEls[tab];
    if (el) indicator = { left: el.offsetLeft, width: el.offsetWidth };
  }
  function setTab(next: string) {
    if (!tabValues.has(next)) return;
    tab = next;
    const url = new URL(window.location.href);
    if (next === "slideshow") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", next);
    }
    window.history.replaceState({}, "", url);
  }
  $effect(() => {
    tab;
    updateIndicator();
  });
  onMount(() => {
    const nextTab = new URLSearchParams(window.location.search).get("tab");
    if (nextTab && tabValues.has(nextTab)) tab = nextTab;
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    const onPop = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("tab");
      if (fromUrl && tabValues.has(fromUrl)) tab = fromUrl;
      else tab = "slideshow";
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("resize", updateIndicator);
      window.removeEventListener("popstate", onPop);
    };
  });

  // Local editable copy, resynced whenever the server data changes.
  // svelte-ignore state_referenced_locally
  let s = $state(structuredClone(data.settings));
  let sig = $state("");
  $effect(() => {
    const next = JSON.stringify(data.settings);
    if (next !== sig) {
      sig = next;
      s = structuredClone(data.settings);
    }
  });

  let saving = $state<string | null>(null);

  const NONE = "__none__";

  function handler(section: string): SubmitFunction {
    return () => {
      saving = section;
      return async ({ result, update }) => {
        await update({ reset: false });
        saving = null;
        if (result.type === "success") {
          await invalidateAll();
          toast.success("Settings saved");
        } else if (result.type === "failure") {
          toast.error(
            (result.data as { error?: string })?.error ?? "Save failed",
          );
        }
      };
    };
  }
</script>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="text-muted-foreground text-sm">
      Configure your frame, storage and automations.
    </p>
  </div>

  <Tabs.Root value={tab} onValueChange={setTab}>
    <div
      class="bg-muted relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        class="bg-background pointer-events-none absolute inset-y-1 rounded-md shadow-sm transition-all duration-300 ease-out"
        style="left: {indicator.left}px; width: {indicator.width}px"
      ></div>
      {#each tabs as t (t.value)}
        <button
          type="button"
          bind:this={btnEls[t.value]}
          onclick={() => setTab(t.value)}
          class={cn(
            "relative z-10 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            tab === t.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      {/each}
    </div>

    <!-- SLIDESHOW -->
    <Tabs.Content value="slideshow">
      <Card.Root>
        <Card.Header>
          <Card.Title>Slideshow</Card.Title>
          <Card.Description
            >How pictures are shown on the frame.</Card.Description
          >
        </Card.Header>
        <form
          method="POST"
          action="?/slideshow"
          use:enhance={handler("slideshow")}
        >
          <Card.Content>
            <Field.FieldGroup>
              <Field.Field>
                <Field.FieldLabel for="slideDurationSec">
                  Seconds per picture: {s.slideDurationSec}s
                </Field.FieldLabel>
                <Input
                  id="slideDurationSec"
                  type="number"
                  min="2"
                  max="3600"
                  bind:value={s.slideDurationSec}
                />
                <input
                  type="hidden"
                  name="slideDurationSec"
                  value={s.slideDurationSec}
                />
              </Field.Field>

              <Field.Field orientation="horizontal">
                <div class="flex flex-1 flex-col gap-1">
                  <Field.FieldLabel for="shuffle"
                    >Shuffle order</Field.FieldLabel
                  >
                  <Field.FieldDescription
                    >Show pictures in random order.</Field.FieldDescription
                  >
                </div>
                <Switch id="shuffle" bind:checked={s.shuffle} />
                <input type="hidden" name="shuffle" value={s.shuffle} />
              </Field.Field>

              <Field.Field>
                <Field.FieldLabel>Transition</Field.FieldLabel>
                <Select.Root type="single" bind:value={s.transition}>
                  <Select.Trigger class="w-full capitalize"
                    >{s.transition}</Select.Trigger
                  >
                  <Select.Content>
                    <Select.Group>
                      <Select.Item value="fade">Fade</Select.Item>
                      <Select.Item value="none">None</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <input type="hidden" name="transition" value={s.transition} />
              </Field.Field>

              <Field.Field>
                <Field.FieldLabel>Picture fit</Field.FieldLabel>
                <Select.Root type="single" bind:value={s.fit}>
                  <Select.Trigger class="w-full capitalize"
                    >{s.fit}</Select.Trigger
                  >
                  <Select.Content>
                    <Select.Group>
                      <Select.Item value="cover"
                        >Cover (fill screen, may crop)</Select.Item
                      >
                      <Select.Item value="contain"
                        >Contain (show whole photo)</Select.Item
                      >
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <input type="hidden" name="fit" value={s.fit} />
              </Field.Field>
            </Field.FieldGroup>
          </Card.Content>
          <Card.Footer class="justify-end">
            <Button type="submit" disabled={saving === "slideshow"}>
              {#if saving === "slideshow"}<Spinner
                  data-icon="inline-start"
                />{/if}
              Save
            </Button>
          </Card.Footer>
        </form>
      </Card.Root>
    </Tabs.Content>

    <!-- OVERLAY -->
    <Tabs.Content value="overlay">
      <Card.Root>
        <Card.Header>
          <Card.Title>Clock & weather overlay</Card.Title>
          <Card.Description
            >Shown over your photos, like a bedside display.</Card.Description
          >
        </Card.Header>
        <form method="POST" action="?/overlay" use:enhance={handler("overlay")}>
          <Card.Content>
            <Field.FieldGroup>
              <Field.Field orientation="horizontal">
                <div class="flex flex-1 flex-col gap-1">
                  <Field.FieldLabel for="showClock">Show clock</Field.FieldLabel
                  >
                  <Field.FieldDescription
                    >Large time in the corner.</Field.FieldDescription
                  >
                </div>
                <Switch id="showClock" bind:checked={s.showClock} />
                <input type="hidden" name="showClock" value={s.showClock} />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel>Clock format</Field.FieldLabel>
                <Select.Root type="single" bind:value={s.clockFormat}>
                  <Select.Trigger class="w-full"
                    >{s.clockFormat === "24h"
                      ? "24-hour"
                      : "12-hour"}</Select.Trigger
                  >
                  <Select.Content>
                    <Select.Group>
                      <Select.Item value="24h">24-hour</Select.Item>
                      <Select.Item value="12h">12-hour</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <input type="hidden" name="clockFormat" value={s.clockFormat} />
              </Field.Field>
              <Separator />
              <Field.Field orientation="horizontal">
                <div class="flex flex-1 flex-col gap-1">
                  <Field.FieldLabel for="showWeather"
                    >Show weather</Field.FieldLabel
                  >
                  <Field.FieldDescription
                    >Temperature & conditions on the frame.</Field.FieldDescription
                  >
                </div>
                <Switch id="showWeather" bind:checked={s.showWeather} />
                <input type="hidden" name="showWeather" value={s.showWeather} />
              </Field.Field>

              <Field.Field>
                <Field.FieldLabel>Weather source</Field.FieldLabel>
                <input
                  type="hidden"
                  name="weatherSource"
                  value={s.weatherSource}
                />
                <ToggleGroup.Root
                  type="single"
                  value={s.weatherSource}
                  onValueChange={(v) =>
                    v && (s.weatherSource = v as typeof s.weatherSource)}
                  variant="outline"
                  spacing={1}
                  class="grid grid-cols-2 gap-2"
                >
                  <ToggleGroup.Item
                    value="ha"
                    class="h-auto flex-col gap-1 rounded-lg py-3"
                  >
                    <span class="font-medium">Home Assistant</span>
                    <span class="text-muted-foreground text-xs"
                      >Weather entity</span
                    >
                  </ToggleGroup.Item>
                  <ToggleGroup.Item
                    value="openweathermap"
                    class="h-auto flex-col gap-1 rounded-lg py-3"
                  >
                    <span class="font-medium">OpenWeatherMap</span>
                    <span class="text-muted-foreground text-xs">API key</span>
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
              </Field.Field>

              {#if s.weatherSource === "ha"}
                <Alert.Root>
                  <Info />
                  <Alert.Description>
                    Choose the weather entity on the <strong
                      >Home Assistant</strong
                    > tab.
                  </Alert.Description>
                </Alert.Root>
              {:else}
                <Field.Field>
                  <Field.FieldLabel for="owmApiKey"
                    >OpenWeatherMap API key</Field.FieldLabel
                  >
                  <Input
                    id="owmApiKey"
                    name="owmApiKey"
                    type="password"
                    bind:value={s.owmApiKey}
                  />
                  <Field.FieldDescription>
                    Free key from openweathermap.org (Current Weather Data).
                  </Field.FieldDescription>
                </Field.Field>
                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="sm:col-span-2">
                    <Field.Field>
                      <Field.FieldLabel for="owmLocation"
                        >Location</Field.FieldLabel
                      >
                      <Input
                        id="owmLocation"
                        name="owmLocation"
                        placeholder="Amsterdam,NL or 52.37,4.90"
                        bind:value={s.owmLocation}
                      />
                      <Field.FieldDescription
                        >City name or "lat,lon".</Field.FieldDescription
                      >
                    </Field.Field>
                  </div>
                  <Field.Field>
                    <Field.FieldLabel>Units</Field.FieldLabel>
                    <Select.Root type="single" bind:value={s.owmUnits}>
                      <Select.Trigger class="w-full"
                        >{s.owmUnits === "imperial"
                          ? "°F"
                          : "°C"}</Select.Trigger
                      >
                      <Select.Content>
                        <Select.Group>
                          <Select.Item value="metric">Celsius (°C)</Select.Item>
                          <Select.Item value="imperial"
                            >Fahrenheit (°F)</Select.Item
                          >
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                    <input type="hidden" name="owmUnits" value={s.owmUnits} />
                  </Field.Field>
                </div>
              {/if}
            </Field.FieldGroup>
          </Card.Content>
          <Card.Footer class="justify-end">
            <Button type="submit" disabled={saving === "overlay"}>
              {#if saving === "overlay"}<Spinner
                  data-icon="inline-start"
                />{/if}
              Save
            </Button>
          </Card.Footer>
        </form>
      </Card.Root>
    </Tabs.Content>

    <!-- STORAGE -->
    <Tabs.Content value="storage">
      <Card.Root>
        <Card.Header>
          <Card.Title>Photo storage</Card.Title>
          <Card.Description
            >Choose where your pictures are kept. Saving verifies the
            connection.</Card.Description
          >
        </Card.Header>
        <form method="POST" action="?/storage" use:enhance={handler("storage")}>
          <Card.Content>
            <input
              type="hidden"
              name="storageBackend"
              value={s.storageBackend}
            />
            <ToggleGroup.Root
              type="single"
              value={s.storageBackend}
              onValueChange={(v) =>
                v && (s.storageBackend = v as typeof s.storageBackend)}
              variant="outline"
              spacing={1}
              class="mb-6 grid grid-cols-3 gap-2"
            >
              <ToggleGroup.Item
                value="local"
                class="h-auto flex-col gap-1 rounded-lg py-3"
              >
                <HardDrive />
                <span class="font-medium">On this server</span>
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="minio"
                class="h-auto flex-col gap-1 rounded-lg py-3"
              >
                <Database />
                <span class="font-medium">MinIO / S3</span>
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="immich"
                class="h-auto flex-col gap-1 rounded-lg py-3"
              >
                <Cloud />
                <span class="font-medium">Immich</span>
              </ToggleGroup.Item>
            </ToggleGroup.Root>

            {#if s.storageBackend === "local"}
              <Alert.Root>
                <Info />
                <Alert.Title>Stored on this device</Alert.Title>
                <Alert.Description>
                  Photos are saved to the server's disk. No configuration
                  required.
                </Alert.Description>
              </Alert.Root>
            {:else if s.storageBackend === "minio"}
              <Field.FieldGroup>
                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="sm:col-span-2">
                    <Field.Field>
                      <Field.FieldLabel for="minioEndpoint"
                        >Endpoint host</Field.FieldLabel
                      >
                      <Input
                        id="minioEndpoint"
                        name="minioEndpoint"
                        bind:value={s.minioEndpoint}
                      />
                      <Field.FieldDescription
                        >Host only, or paste a full https:// URL.</Field.FieldDescription
                      >
                    </Field.Field>
                  </div>
                  <Field.Field>
                    <Field.FieldLabel for="minioPort">Port</Field.FieldLabel>
                    <Input
                      id="minioPort"
                      name="minioPort"
                      type="number"
                      bind:value={s.minioPort}
                    />
                  </Field.Field>
                </div>
                <Field.Field orientation="horizontal">
                  <div class="flex flex-1 flex-col gap-1">
                    <Field.FieldLabel for="minioUseSSL"
                      >Use SSL (https)</Field.FieldLabel
                    >
                    <Field.FieldDescription
                      >Turn on if your MinIO uses TLS.</Field.FieldDescription
                    >
                  </div>
                  <Switch id="minioUseSSL" bind:checked={s.minioUseSSL} />
                  <input
                    type="hidden"
                    name="minioUseSSL"
                    value={s.minioUseSSL}
                  />
                </Field.Field>
                <div class="grid gap-4 sm:grid-cols-2">
                  <Field.Field>
                    <Field.FieldLabel for="minioAccessKey"
                      >Access key</Field.FieldLabel
                    >
                    <Input
                      id="minioAccessKey"
                      name="minioAccessKey"
                      bind:value={s.minioAccessKey}
                    />
                  </Field.Field>
                  <Field.Field>
                    <Field.FieldLabel for="minioSecretKey"
                      >Secret key</Field.FieldLabel
                    >
                    <Input
                      id="minioSecretKey"
                      name="minioSecretKey"
                      type="password"
                      bind:value={s.minioSecretKey}
                    />
                  </Field.Field>
                </div>
                <Field.Field>
                  <Field.FieldLabel for="minioBucket">Bucket</Field.FieldLabel>
                  <Input
                    id="minioBucket"
                    name="minioBucket"
                    bind:value={s.minioBucket}
                  />
                </Field.Field>
              </Field.FieldGroup>
            {:else if s.storageBackend === "immich"}
              <Field.FieldGroup>
                <Field.Field>
                  <Field.FieldLabel for="immichUrl"
                    >Immich server URL</Field.FieldLabel
                  >
                  <Input
                    id="immichUrl"
                    name="immichUrl"
                    placeholder="http://immich.local:2283"
                    bind:value={s.immichUrl}
                  />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="immichApiKey">API key</Field.FieldLabel
                  >
                  <Input
                    id="immichApiKey"
                    name="immichApiKey"
                    type="password"
                    bind:value={s.immichApiKey}
                  />
                  <Field.FieldDescription
                    >Immich → Account Settings → API Keys.</Field.FieldDescription
                  >
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel>Album to display</Field.FieldLabel>
                  {#if data.immich.error}
                    <Alert.Root variant="destructive">
                      <TriangleAlert />
                      <Alert.Description>{data.immich.error}</Alert.Description>
                    </Alert.Root>
                  {:else if data.immich.albums.length === 0}
                    <Field.FieldDescription
                      >Save the connection first to load albums.</Field.FieldDescription
                    >
                  {/if}
                  <Select.Root
                    type="single"
                    value={s.immichAlbumId || NONE}
                    onValueChange={(v) =>
                      (s.immichAlbumId = v === NONE ? "" : v)}
                  >
                    <Select.Trigger class="w-full">
                      {s.immichAlbumId
                        ? (data.immich.albums.find(
                            (a) => a.id === s.immichAlbumId,
                          )?.albumName ?? s.immichAlbumId)
                        : "Recent photos (whole library)"}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Group>
                        <Select.Item value={NONE}
                          >Recent photos (whole library)</Select.Item
                        >
                        {#each data.immich.albums as a (a.id)}
                          <Select.Item value={a.id}
                            >{a.albumName} ({a.assetCount})</Select.Item
                          >
                        {/each}
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                  <input
                    type="hidden"
                    name="immichAlbumId"
                    value={s.immichAlbumId}
                  />
                  <Field.FieldDescription>
                    Photos uploaded through the frame are added to this album.
                  </Field.FieldDescription>
                </Field.Field>
              </Field.FieldGroup>
            {/if}
          </Card.Content>
          <Card.Footer class="justify-end">
            <Button type="submit" disabled={saving === "storage"}>
              {#if saving === "storage"}<Spinner
                  data-icon="inline-start"
                />{/if}
              {s.storageBackend === "local" ? "Save" : "Test & save"}
            </Button>
          </Card.Footer>
        </form>
      </Card.Root>
    </Tabs.Content>

    <!-- HOME ASSISTANT -->
    <Tabs.Content value="ha">
      <div class="flex flex-col gap-6">
        <Card.Root>
          <Card.Header>
            <Card.Title>Home Assistant connection</Card.Title>
            <Card.Description>
              Create a long-lived access token in Home Assistant (Profile →
              Security).
            </Card.Description>
          </Card.Header>
          <form
            method="POST"
            action="?/homeassistant"
            use:enhance={handler("homeassistant")}
          >
            <Card.Content>
              <Field.FieldGroup>
                <Field.Field>
                  <Field.FieldLabel for="haUrl">Base URL</Field.FieldLabel>
                  <Input
                    id="haUrl"
                    name="haUrl"
                    placeholder="http://homeassistant.local:8123"
                    bind:value={s.haUrl}
                  />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="haToken"
                    >Long-lived access token</Field.FieldLabel
                  >
                  <Input
                    id="haToken"
                    name="haToken"
                    type="password"
                    bind:value={s.haToken}
                  />
                </Field.Field>
              </Field.FieldGroup>
            </Card.Content>
            <Card.Footer class="justify-end">
              <Button type="submit" disabled={saving === "homeassistant"}>
                {#if saving === "homeassistant"}<Spinner
                    data-icon="inline-start"
                  />{/if}
                Test & save
              </Button>
            </Card.Footer>
          </form>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Card.Title>Motion & devices</Card.Title>
            <Card.Description
              >Pick entities and control the display with motion.</Card.Description
            >
          </Card.Header>
          <form method="POST" action="?/motion" use:enhance={handler("motion")}>
            <Card.Content>
              {#if data.entities.error}
                <Alert.Root variant="destructive" class="mb-4">
                  <TriangleAlert />
                  <Alert.Description
                    >Couldn't load entities: {data.entities
                      .error}</Alert.Description
                  >
                </Alert.Root>
              {:else if !s.haUrl}
                <Alert.Root class="mb-4">
                  <Info />
                  <Alert.Description
                    >Connect Home Assistant above to choose entities.</Alert.Description
                  >
                </Alert.Root>
              {/if}
              <Field.FieldGroup>
                <Field.Field>
                  <Field.FieldLabel>Weather entity</Field.FieldLabel>
                  <EntityCombobox
                    items={data.entities.weather}
                    bind:value={s.haWeatherEntity}
                    placeholder="Search weather entities…"
                  />
                  <input
                    type="hidden"
                    name="haWeatherEntity"
                    value={s.haWeatherEntity}
                  />
                </Field.Field>

                <Field.Field>
                  <Field.FieldLabel>Motion sensor</Field.FieldLabel>
                  <EntityCombobox
                    items={data.entities.motion}
                    bind:value={s.haMotionEntity}
                    placeholder="Search binary sensors…"
                  />
                  <input
                    type="hidden"
                    name="haMotionEntity"
                    value={s.haMotionEntity}
                  />
                </Field.Field>

                <Field.Field>
                  <Field.FieldLabel
                    >Display power entity (optional)</Field.FieldLabel
                  >
                  <EntityCombobox
                    items={data.entities.display}
                    bind:value={s.haDisplayEntity}
                    placeholder="Search switches, lights, media players…"
                  />
                  <input
                    type="hidden"
                    name="haDisplayEntity"
                    value={s.haDisplayEntity}
                  />
                  <Field.FieldDescription>
                    A switch/light/media_player toggled on when there's motion,
                    off when idle.
                  </Field.FieldDescription>
                </Field.Field>

                <Field.Field>
                  <Field.FieldLabel>Sensors on the frame</Field.FieldLabel>
                  <MultiEntityCombobox
                    items={data.entities.sensor}
                    bind:value={s.frameSensors}
                    placeholder="Search sensors…"
                    addLabel="Add a sensor"
                  />
                  <input
                    type="hidden"
                    name="frameSensors"
                    value={s.frameSensors.join(",")}
                  />
                  <Field.FieldDescription>
                    Show live values (temperature, humidity, …) in the corner of
                    the frame.
                  </Field.FieldDescription>
                </Field.Field>

                <Separator />

                <Field.Field orientation="horizontal">
                  <div class="flex flex-1 flex-col gap-1">
                    <Field.FieldLabel for="motionEnabled"
                      >Turn display off when idle</Field.FieldLabel
                    >
                    <Field.FieldDescription>
                      Blank the frame (and the display entity) when no motion is
                      detected.
                    </Field.FieldDescription>
                  </div>
                  <Switch id="motionEnabled" bind:checked={s.motionEnabled} />
                  <input
                    type="hidden"
                    name="motionEnabled"
                    value={s.motionEnabled}
                  />
                </Field.Field>

                <Field.Field>
                  <Field.FieldLabel for="motionTimeoutSec">
                    Turn off after no motion for {Math.round(
                      s.motionTimeoutSec / 60,
                    )} min ({s.motionTimeoutSec}s)
                  </Field.FieldLabel>
                  <Input
                    id="motionTimeoutSec"
                    type="number"
                    min="10"
                    step="10"
                    bind:value={s.motionTimeoutSec}
                  />
                  <input
                    type="hidden"
                    name="motionTimeoutSec"
                    value={s.motionTimeoutSec}
                  />
                </Field.Field>

                <Separator />

                <Field.Field orientation="horizontal">
                  <div class="flex flex-1 flex-col gap-1">
                    <Field.FieldLabel for="screenLightEnabled"
                      >Follow a light</Field.FieldLabel
                    >
                    <Field.FieldDescription>
                      Screen is on when the chosen light/switch is on, off when
                      it's off.
                    </Field.FieldDescription>
                  </div>
                  <Switch
                    id="screenLightEnabled"
                    bind:checked={s.screenLightEnabled}
                  />
                  <input
                    type="hidden"
                    name="screenLightEnabled"
                    value={s.screenLightEnabled}
                  />
                </Field.Field>

                <Field.Field>
                  <Field.FieldLabel>Light / switch</Field.FieldLabel>
                  <EntityCombobox
                    items={data.entities.display}
                    bind:value={s.screenLightEntity}
                    placeholder="Search lights & switches…"
                  />
                  <input
                    type="hidden"
                    name="screenLightEntity"
                    value={s.screenLightEntity}
                  />
                </Field.Field>
              </Field.FieldGroup>
            </Card.Content>
            <Card.Footer class="justify-end">
              <Button type="submit" disabled={saving === "motion"}>
                {#if saving === "motion"}<Spinner
                    data-icon="inline-start"
                  />{/if}
                Save
              </Button>
            </Card.Footer>
          </form>
        </Card.Root>
      </div>
    </Tabs.Content>

    <!-- ACCOUNT -->
    <Tabs.Content value="account">
      <Card.Root>
        <Card.Header>
          <Card.Title>Your account</Card.Title>
          <Card.Description
            >Change your username or password. Confirm with your current
            password.</Card.Description
          >
        </Card.Header>
        <form method="POST" action="?/account" use:enhance={handler("account")}>
          <Card.Content>
            <Field.FieldGroup>
              <Field.Field>
                <Field.FieldLabel for="acc-username">Username</Field.FieldLabel>
                <Input
                  id="acc-username"
                  name="username"
                  value={data.username}
                  required
                />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="acc-new">New password</Field.FieldLabel>
                <Input
                  id="acc-new"
                  name="newPassword"
                  type="password"
                  placeholder="Leave blank to keep current"
                />
                <Field.FieldDescription
                  >At least 6 characters.</Field.FieldDescription
                >
              </Field.Field>
              <Separator />
              <Field.Field>
                <Field.FieldLabel for="acc-current"
                  >Current password</Field.FieldLabel
                >
                <Input
                  id="acc-current"
                  name="currentPassword"
                  type="password"
                  required
                />
                <Field.FieldDescription
                  >Required to save changes.</Field.FieldDescription
                >
              </Field.Field>
            </Field.FieldGroup>
          </Card.Content>
          <Card.Footer class="justify-end">
            <Button type="submit" disabled={saving === "account"}>
              {#if saving === "account"}<Spinner
                  data-icon="inline-start"
                />{/if}
              Update account
            </Button>
          </Card.Footer>
        </form>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>
