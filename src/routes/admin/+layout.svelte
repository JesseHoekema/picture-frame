<script lang="ts">
  import { page } from "$app/state";
  import type { LayoutData } from "./$types";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { cn } from "$lib/utils";
  import { toggleMode } from "mode-watcher";
  import ImageIcon from "@lucide/svelte/icons/image";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import Images from "@lucide/svelte/icons/images";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Settings from "@lucide/svelte/icons/settings";
  import Monitor from "@lucide/svelte/icons/monitor";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";

  let {
    data,
    children,
  }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  const nav = [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/pictures", label: "Pictures", icon: Images },
    { href: "/admin/links", label: "Share links", icon: Link2 },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  function isActive(href: string) {
    return href === "/admin"
      ? page.url.pathname === "/admin"
      : page.url.pathname.startsWith(href);
  }
</script>

<div class="bg-muted/30 flex min-h-svh">
  <!-- Sidebar -->
  <aside
    class="bg-sidebar sticky top-0 hidden h-svh w-60 shrink-0 flex-col self-start overflow-y-auto border-r p-3 md:flex"
  >
    <a href="/admin" class="mb-4 flex items-center gap-2 px-2 py-1">
      <div
        class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"
      >
        <ImageIcon />
      </div>
      <span class="font-semibold">Picture Frame</span>
    </a>
    <nav class="flex flex-col gap-1">
      {#each nav as item (item.href)}
        {@const Icon = item.icon}
        <a
          href={item.href}
          class={cn(
            buttonVariants({
              variant: isActive(item.href) ? "secondary" : "ghost",
              size: "sm",
            }),
            "justify-start",
          )}
        >
          <Icon data-icon="inline-start" />
          {item.label}
        </a>
      {/each}
    </nav>
    <div class="mt-auto flex flex-col gap-1">
      <Separator class="my-2" />
      <a
        href="/frame"
        target="_blank"
        class={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "justify-start",
        )}
      >
        <Monitor data-icon="inline-start" />
        Open frame
      </a>
      <Button
        variant="ghost"
        size="sm"
        class="justify-start"
        onclick={() => toggleMode()}
      >
        <Sun data-icon="inline-start" class="dark:hidden" />
        <Moon data-icon="inline-start" class="hidden dark:block" />
        Theme
      </Button>
      <form method="POST" action="/logout">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          class="w-full justify-start"
        >
          <LogOut data-icon="inline-start" />
          Sign out ({data.user?.username})
        </Button>
      </form>
    </div>
  </aside>

  <!-- Mobile top bar -->
  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="bg-background flex items-center gap-2 border-b p-2 md:hidden"
    >
      <div
        class="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md"
      >
        <ImageIcon />
      </div>
      <span class="font-semibold">Picture Frame</span>
      <nav class="ml-auto flex gap-1">
        {#each nav as item (item.href)}
          {@const Icon = item.icon}
          <a
            href={item.href}
            aria-label={item.label}
            class={cn(
              buttonVariants({
                variant: isActive(item.href) ? "secondary" : "ghost",
                size: "icon",
              }),
            )}
          >
            <Icon />
          </a>
        {/each}
        <Button
          variant="ghost"
          size="icon"
          onclick={() => toggleMode()}
          aria-label="Toggle theme"
        >
          <Sun class="dark:hidden" />
          <Moon class="hidden dark:block" />
        </Button>
      </nav>
    </header>

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <div class="mx-auto max-w-5xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
