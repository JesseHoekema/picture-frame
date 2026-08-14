<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";
  import Power from "@lucide/svelte/icons/power";
  import Cpu from "@lucide/svelte/icons/cpu";
  import Thermometer from "@lucide/svelte/icons/thermometer";
  import MemoryStick from "@lucide/svelte/icons/memory-stick";
  import Clock from "@lucide/svelte/icons/clock";
  import Gauge from "@lucide/svelte/icons/gauge";
  import ImagesIcon from "@lucide/svelte/icons/images";
  import Link2 from "@lucide/svelte/icons/link-2";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import Database from "@lucide/svelte/icons/database";
  import Cloud from "@lucide/svelte/icons/cloud";
  import CloudSun from "@lucide/svelte/icons/cloud-sun";
  import HousePlug from "@lucide/svelte/icons/house-plug";
  import Radar from "@lucide/svelte/icons/radar";
  import Timer from "@lucide/svelte/icons/timer";
  import Upload from "@lucide/svelte/icons/upload";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Plus from "@lucide/svelte/icons/plus";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";

  let { data }: { data: PageData } = $props();

  let screenBusy = $state(false);
  async function setScreen(on: boolean) {
    screenBusy = true;
    const fd = new FormData();
    fd.set("screenPower", String(on));
    await fetch("?/screenPower", { method: "POST", body: fd });
    await invalidateAll();
    screenBusy = false;
    toast.success(on ? "Screen turned on" : "Screen turned off");
  }

  // svelte-ignore state_referenced_locally
  let pollValue = $state(data.pollIntervalSec);
  let pollBusy = $state(false);
  $effect(() => {
    pollValue = data.pollIntervalSec;
  });
  async function savePollInterval() {
    const v = Math.min(3600, Math.max(1, Math.round(pollValue || 15)));
    pollBusy = true;
    const fd = new FormData();
    fd.set("pollIntervalSec", String(v));
    await fetch("?/pollInterval", { method: "POST", body: fd });
    await invalidateAll();
    pollBusy = false;
    toast.success(`Refresh interval set to ${v}s`);
  }

  // svelte-ignore state_referenced_locally
  let system = $state(data.system);
  $effect(() => {
    system = data.system;
  });
  onMount(() => {
    if (!data.system.isPi) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/system");
        if (r.ok) system = await r.json();
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(id);
  });

  function fmtBytes(n: number): string {
    const gb = n / 1024 ** 3;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${Math.round(n / 1024 ** 2)} MB`;
  }
  function fmtUptime(sec: number): string {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const StorageIcon = $derived(
    data.storageBackend === "local"
      ? HardDrive
      : data.storageBackend === "minio"
        ? Database
        : Cloud,
  );

  const stats = $derived([
    { label: "Photos", value: String(data.imageCount), icon: ImagesIcon },
    {
      label: "Share links",
      value: `${data.enabledLinkCount}/${data.linkCount}`,
      sub: "active",
      icon: Link2,
    },
    { label: "Storage", value: data.storageLabel, icon: StorageIcon },
    { label: "Weather", value: data.weatherLabel, icon: CloudSun },
  ]);
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Welcome back{data.username ? `, ${data.username}` : ""}
      </h1>
      <p class="text-muted-foreground text-sm">
        Here's what your frame is up to.
      </p>
    </div>
    <div class="flex gap-2">
      <a
        href="/admin/pictures"
        class={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Upload data-icon="inline-start" />
        Upload
      </a>
      <a href="/frame" target="_blank" class={buttonVariants({ size: "sm" })}>
        <ExternalLink data-icon="inline-start" />
        Open frame
      </a>
    </div>
  </div>

  <!-- Stat cards -->
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {#each stats as stat (stat.label)}
      {@const Icon = stat.icon}
      <Card.Root>
        <Card.Content class="flex items-center gap-3 py-4">
          <div
            class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg"
          >
            <Icon />
          </div>
          <div class="min-w-0">
            <div class="text-muted-foreground text-xs">{stat.label}</div>
            <div class="truncate text-lg font-semibold">{stat.value}</div>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- Device (Raspberry Pi) -->
  {#if system.isPi}
    <Card.Root>
      <Card.Header
        class="flex-row items-center justify-between gap-2 space-y-0"
      >
        <div>
          <Card.Title>Device</Card.Title>
          <Card.Description>{system.model ?? "Raspberry Pi"} · {system.hostname}</Card.Description>
        </div>
        <Badge variant="secondary" class="gap-1">
          <Cpu class="size-3" />
          Raspberry Pi
        </Badge>
      </Card.Header>
      <Card.Content>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex flex-col gap-1.5">
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <Thermometer class="size-4" /> CPU temperature
            </div>
            <div class="text-lg font-semibold">
              {system.cpuTempC != null ? `${system.cpuTempC}°C` : "—"}
            </div>
            <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                class={cn(
                  "h-full rounded-full transition-all",
                  (system.cpuTempC ?? 0) >= 75
                    ? "bg-red-500"
                    : (system.cpuTempC ?? 0) >= 60
                      ? "bg-amber-500"
                      : "bg-green-500",
                )}
                style="width: {Math.min(100, ((system.cpuTempC ?? 0) / 90) * 100)}%"
              ></div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <MemoryStick class="size-4" /> Memory
            </div>
            <div class="text-lg font-semibold">{system.memUsedPct}%</div>
            <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                class="bg-primary h-full rounded-full transition-all"
                style="width: {system.memUsedPct}%"
              ></div>
            </div>
            <div class="text-muted-foreground text-xs">
              {fmtBytes(system.memUsed)} / {fmtBytes(system.memTotal)}
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <Gauge class="size-4" /> CPU load (1m)
            </div>
            <div class="text-lg font-semibold">{system.load1.toFixed(2)}</div>
            <div class="text-muted-foreground text-xs">{system.cpuCount} cores</div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <Clock class="size-4" /> Uptime
            </div>
            <div class="text-lg font-semibold">{fmtUptime(system.uptimeSec)}</div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <div class="grid gap-4 lg:grid-cols-3">
    <!-- Live preview -->
    <Card.Root class="lg:col-span-2">
      <Card.Header
        class="flex-row items-center justify-between gap-2 space-y-0"
      >
        <div>
          <Card.Title>Now showing</Card.Title>
          <Card.Description>Live preview of the frame</Card.Description>
        </div>
        <div class="flex items-center gap-3">
          <div
            class={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5",
              data.screenPower ? "border-primary/30" : "bg-muted",
            )}
          >
            <Power
              class={cn(
                "size-4",
                data.screenPower ? "text-green-600" : "text-muted-foreground",
              )}
            />
            <span class="text-sm font-medium"
              >{data.screenPower ? "Screen on" : "Screen off"}</span
            >
            <Switch
              checked={data.screenPower}
              onCheckedChange={(v: boolean) => setScreen(v)}
              disabled={screenBusy}
              aria-label="Toggle frame screen"
            />
          </div>
          {#if data.screenPower}
            <Badge variant="secondary" class="gap-1">
              <span class="relative flex size-2">
                <span
                  class="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60"
                ></span>
                <span
                  class="bg-primary relative inline-flex size-2 rounded-full"
                ></span>
              </span>
              Live
            </Badge>
          {/if}
        </div>
      </Card.Header>
      <Card.Content>
        <div
          class="bg-muted relative w-full overflow-hidden rounded-lg border"
          style="aspect-ratio: 16 / 9;"
        >
          {#if data.imageCount > 0}
            <iframe
              title="Frame preview"
              src="/frame"
              scrolling="no"
              class="pointer-events-none absolute left-0 top-0"
              style="width: 200%; height: 200%; transform: scale(0.5); transform-origin: 0 0;"
            ></iframe>
          {:else}
            <div
              class="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <ImagesIcon />
              <span class="text-sm">No pictures yet</span>
              <a
                href="/admin/pictures"
                class={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Add photos
              </a>
            </div>
          {/if}
        </div>
      </Card.Content>
      <Card.Footer class="flex-wrap items-end justify-between gap-3">
        <div class="flex items-end gap-2">
          <div class="flex flex-col gap-1">
            <label for="pollInterval" class="text-muted-foreground text-xs">
              Live refresh interval (seconds)
            </label>
            <Input
              id="pollInterval"
              type="number"
              min="1"
              max="3600"
              bind:value={pollValue}
              class="h-9 w-28"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onclick={savePollInterval}
            disabled={pollBusy}
          >
            Save
          </Button>
        </div>
        <p class="text-muted-foreground max-w-[16rem] text-xs">
          How often weather, motion &amp; sensors refresh. Screen on/off is
          always instant.
        </p>
      </Card.Footer>
    </Card.Root>

    <!-- Storage source -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Where photos come from</Card.Title>
        <Card.Description>Active storage source</Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <div
            class="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl"
          >
            <StorageIcon />
          </div>
          <div class="min-w-0">
            <div class="font-medium">{data.storageLabel}</div>
            <p class="text-muted-foreground text-sm">{data.storageDetail}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          {#if data.storageConfigured}
            <CircleCheck class="size-4 text-green-600" />
            <span class="text-muted-foreground">Connected & ready</span>
          {:else}
            <CircleAlert class="text-destructive size-4" />
            <span class="text-muted-foreground">Needs configuration</span>
          {/if}
        </div>
        <a
          href="/admin/settings"
          class={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full",
          )}
        >
          Manage storage
        </a>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- System info -->
  <Card.Root>
    <Card.Header>
      <Card.Title>System</Card.Title>
      <Card.Description
        >Configuration & integrations at a glance</Card.Description
      >
    </Card.Header>
    <Card.Content>
      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="flex items-center gap-3">
          <Timer class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Slide duration</div>
            <div class="text-sm font-medium">
              {data.slideDurationSec}s{data.shuffle ? " · shuffled" : ""}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <CloudSun class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Overlay</div>
            <div class="text-sm font-medium">
              {data.showClock ? "Clock" : ""}{data.showClock && data.showWeather
                ? " + "
                : ""}{data.showWeather ? "Weather" : ""}{!data.showClock &&
              !data.showWeather
                ? "None"
                : ""}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <HousePlug class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Home Assistant</div>
            <div class="text-sm font-medium">
              {#if data.haConnected}
                <Badge variant="secondary">Connected</Badge>
              {:else}
                <span class="text-muted-foreground">Not connected</span>
              {/if}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Radar class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Motion control</div>
            <div class="text-sm font-medium">
              {data.motionEnabled
                ? `On · off after ${Math.round(data.motionTimeoutSec / 60)} min`
                : "Off"}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Link2 class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Share links</div>
            <div class="text-sm font-medium">
              {data.enabledLinkCount} active of {data.linkCount}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Database class="text-muted-foreground size-5" />
          <div>
            <div class="text-muted-foreground text-xs">Runtime</div>
            <div class="text-sm font-medium">Node {data.nodeVersion}</div>
          </div>
        </div>
      </div>
      <Separator class="my-4" />
      <div class="flex flex-wrap gap-2">
        <a
          href="/admin/pictures"
          class={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Upload data-icon="inline-start" />
          Upload photos
        </a>
        <a
          href="/admin/links"
          class={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus data-icon="inline-start" />
          New share link
        </a>
        <a
          href="/admin/settings"
          class={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Settings
        </a>
      </div>
    </Card.Content>
  </Card.Root>
</div>
