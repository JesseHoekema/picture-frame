<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import { Switch } from "$lib/components/ui/switch";
  import * as Card from "$lib/components/ui/card";
  import * as Field from "$lib/components/ui/field";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Empty from "$lib/components/ui/empty";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { toast } from "svelte-sonner";
  import Plus from "@lucide/svelte/icons/plus";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Lock from "@lucide/svelte/icons/lock";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  let { data }: { data: PageData } = $props();

  let createOpen = $state(false);
  let origin = $state("");
  $effect(() => {
    origin = window.location.origin;
  });

  function shareUrl(token: string) {
    return `${origin}/share/${token}`;
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function toggleLink(id: number, enabled: boolean) {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("enabled", String(enabled));
    await fetch("?/toggle", { method: "POST", body: fd });
    await invalidateAll();
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Share links</h1>
      <p class="text-muted-foreground text-sm">
        Let others upload photos to your frame. Each link can have its own
        password.
      </p>
    </div>
    <Dialog.Root bind:open={createOpen}>
      <Dialog.Trigger class="inline-flex">
        <Button>
          <Plus data-icon="inline-start" />
          New link
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Create share link</Dialog.Title>
          <Dialog.Description
            >Anyone with the link (and password) can add photos.</Dialog.Description
          >
        </Dialog.Header>
        <form
          method="POST"
          action="?/create"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === "success") {
                await invalidateAll();
                createOpen = false;
                toast.success("Share link created");
              } else if (result.type === "failure") {
                toast.error(
                  (result.data as { error?: string })?.error ?? "Failed",
                );
              }
            };
          }}
        >
          <Field.FieldGroup>
            <Field.Field>
              <Field.FieldLabel for="name">Name</Field.FieldLabel>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Family & friends"
                required
              />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="password"
                >Password (optional)</Field.FieldLabel
              >
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Leave blank for none"
              />
              <Field.FieldDescription
                >Uploaders must enter this to add photos.</Field.FieldDescription
              >
            </Field.Field>
            <Dialog.Footer>
              <Button type="submit">Create link</Button>
            </Dialog.Footer>
          </Field.FieldGroup>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  </div>

  {#if data.links.length === 0}
    <Empty.Root class="border-border rounded-xl border border-dashed py-16">
      <Empty.Header>
        <Empty.Media variant="icon">
          <Link2 />
        </Empty.Media>
        <Empty.Title>No share links yet</Empty.Title>
        <Empty.Description
          >Create a link to collect photos from other people.</Empty.Description
        >
      </Empty.Header>
      <Empty.Content>
        <Button onclick={() => (createOpen = true)}>
          <Plus data-icon="inline-start" />
          New link
        </Button>
      </Empty.Content>
    </Empty.Root>
  {:else}
    <div class="flex flex-col gap-3">
      {#each data.links as link (link.id)}
        <Card.Root>
          <Card.Content
            class="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0 flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{link.name}</span>
                {#if link.password_hash}
                  <Badge variant="secondary"
                    ><Lock class="mr-1 size-3" /> Password</Badge
                  >
                {/if}
                {#if !link.enabled}
                  <Badge variant="outline">Disabled</Badge>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => copy(link.token)}
                class="text-muted-foreground hover:text-foreground truncate text-left text-xs"
                title="Click to copy"
              >
                {origin}/share/{link.token}
              </button>
              <span class="text-muted-foreground text-xs"
                >{link.upload_count} upload(s)</span
              >
            </div>

            <div class="flex items-center gap-2">
              <div class="flex items-center gap-2 pr-1">
                <Switch
                  checked={!!link.enabled}
                  onCheckedChange={(checked: boolean) =>
                    toggleLink(link.id, checked)}
                  aria-label="Enable link"
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                onclick={() => copy(link.token)}
                aria-label="Copy"
              >
                <Copy />
              </Button>
              <a
                href={shareUrl(link.token)}
                target="_blank"
                class="inline-flex"
                aria-label="Open share page"
              >
                <Button variant="outline" size="icon"><ExternalLink /></Button>
              </a>

              <!-- Change password -->
              <Dialog.Root>
                <Dialog.Trigger aria-label="Set password">
                  <Button variant="outline" size="icon"><KeyRound /></Button>
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Password for "{link.name}"</Dialog.Title>
                    <Dialog.Description
                      >Set a new password, or clear it to remove.</Dialog.Description
                    >
                  </Dialog.Header>
                  <form
                    method="POST"
                    action="?/setPassword"
                    use:enhance={() => {
                      return async ({ result }) => {
                        if (result.type === "success") {
                          await invalidateAll();
                          toast.success("Password updated");
                        }
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={link.id} />
                    <Field.FieldGroup>
                      <Field.Field>
                        <Field.FieldLabel for={`pw-${link.id}`}
                          >New password</Field.FieldLabel
                        >
                        <Input
                          id={`pw-${link.id}`}
                          name="password"
                          type="password"
                          placeholder="Blank = no password"
                        />
                      </Field.Field>
                      <Dialog.Footer>
                        <Button type="submit">Save</Button>
                      </Dialog.Footer>
                    </Field.FieldGroup>
                  </form>
                </Dialog.Content>
              </Dialog.Root>

              <!-- Delete -->
              <AlertDialog.Root>
                <AlertDialog.Trigger
                  aria-label="Delete link"
                  class="border-input hover:bg-accent inline-flex size-9 items-center justify-center rounded-md border"
                >
                  <Trash2 class="text-destructive size-4" />
                </AlertDialog.Trigger>
                <AlertDialog.Content>
                  <AlertDialog.Header>
                    <AlertDialog.Title>Delete "{link.name}"?</AlertDialog.Title>
                    <AlertDialog.Description>
                      The link will stop working. Photos already uploaded
                      through it stay in your frame.
                    </AlertDialog.Description>
                  </AlertDialog.Header>
                  <AlertDialog.Footer>
                    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                    <form
                      method="POST"
                      action="?/delete"
                      use:enhance={() => {
                        return async ({ result }) => {
                          if (result.type === "success") {
                            await invalidateAll();
                            toast.success("Link deleted");
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={link.id} />
                      <AlertDialog.Action type="submit"
                        >Delete</AlertDialog.Action
                      >
                    </form>
                  </AlertDialog.Footer>
                </AlertDialog.Content>
              </AlertDialog.Root>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
