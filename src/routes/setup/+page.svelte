<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";
  import * as Card from "$lib/components/ui/card";
  import * as Field from "$lib/components/ui/field";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import * as Alert from "$lib/components/ui/alert";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import { Separator } from "$lib/components/ui/separator";
  import { Spinner } from "$lib/components/ui/spinner";
  import ImageIcon from "@lucide/svelte/icons/image";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import Database from "@lucide/svelte/icons/database";
  import Cloud from "@lucide/svelte/icons/cloud";
  import Info from "@lucide/svelte/icons/info";

  let { form }: { form: ActionData } = $props();
  let submitting = $state(false);
  // svelte-ignore state_referenced_locally
  let backend = $state<string>(
    (form?.values?.storageBackend as string) ?? "local",
  );
  let useSSL = $state(false);
</script>

<div class="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6">
  <div class="flex items-center gap-3">
    <div
      class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg"
    >
      <ImageIcon />
    </div>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Welcome to Picture Frame
      </h1>
      <p class="text-muted-foreground text-sm">
        Let's set up your account and storage.
      </p>
    </div>
  </div>

  <form
    method="POST"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    {#if form?.error}
      <Alert.Root variant="destructive" class="mb-4">
        <TriangleAlert />
        <Alert.Title>Setup failed</Alert.Title>
        <Alert.Description>{form.error}</Alert.Description>
      </Alert.Root>
    {/if}

    <Card.Root>
      <Card.Header>
        <Card.Title>Admin account</Card.Title>
        <Card.Description
          >You'll use this to sign in to the dashboard.</Card.Description
        >
      </Card.Header>
      <Card.Content>
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="username">Username</Field.FieldLabel>
            <Input
              id="username"
              name="username"
              value={form?.values?.username ?? ""}
              required
            />
          </Field.Field>
          <div class="grid gap-4 sm:grid-cols-2">
            <Field.Field>
              <Field.FieldLabel for="password">Password</Field.FieldLabel>
              <Input id="password" name="password" type="password" required />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="confirm">Confirm password</Field.FieldLabel
              >
              <Input id="confirm" name="confirm" type="password" required />
            </Field.Field>
          </div>
        </Field.FieldGroup>
      </Card.Content>

      <Separator />

      <Card.Header>
        <Card.Title>Where should photos be stored?</Card.Title>
        <Card.Description
          >You can change this later in Settings.</Card.Description
        >
      </Card.Header>
      <Card.Content>
        <input type="hidden" name="storageBackend" value={backend} />
        <ToggleGroup.Root
          type="single"
          value={backend}
          onValueChange={(v) => v && (backend = v)}
          variant="outline"
          spacing={1}
          class="mb-6 grid grid-cols-3 gap-2"
        >
          <ToggleGroup.Item value="local" class="h-auto flex-col gap-1 rounded-lg py-3">
            <HardDrive />
            <span class="font-medium">On this server</span>
            <span class="text-muted-foreground text-xs">Simplest</span>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="minio" class="h-auto flex-col gap-1 rounded-lg py-3">
            <Database />
            <span class="font-medium">MinIO / S3</span>
            <span class="text-muted-foreground text-xs">Object storage</span>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="immich" class="h-auto flex-col gap-1 rounded-lg py-3">
            <Cloud />
            <span class="font-medium">Immich</span>
            <span class="text-muted-foreground text-xs">Photo server</span>
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        {#if backend === "local"}
          <Alert.Root>
            <Info />
            <Alert.Title>Stored on this device</Alert.Title>
            <Alert.Description>
              Photos are saved to the server's disk. No extra configuration
              needed — you're ready to go.
            </Alert.Description>
          </Alert.Root>
        {:else if backend === "minio"}
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
                    placeholder="minio.example.com"
                    value={form?.values?.minioEndpoint ?? ""}
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
                  value={form?.values?.minioPort ?? 9000}
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
              <Switch
                id="minioUseSSL"
                name="minioUseSSL"
                bind:checked={useSSL}
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
                  value={form?.values?.minioAccessKey ?? ""}
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
                />
              </Field.Field>
            </div>
            <Field.Field>
              <Field.FieldLabel for="minioBucket">Bucket name</Field.FieldLabel>
              <Input
                id="minioBucket"
                name="minioBucket"
                value={form?.values?.minioBucket ?? "picture-frame"}
              />
            </Field.Field>
          </Field.FieldGroup>
        {:else if backend === "immich"}
          <Field.FieldGroup>
            <Field.Field>
              <Field.FieldLabel for="immichUrl"
                >Immich server URL</Field.FieldLabel
              >
              <Input
                id="immichUrl"
                name="immichUrl"
                placeholder="http://immich.local:2283"
                value={form?.values?.immichUrl ?? ""}
              />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="immichApiKey">API key</Field.FieldLabel>
              <Input id="immichApiKey" name="immichApiKey" type="password" />
              <Field.FieldDescription
                >Create one in Immich under Account Settings → API Keys.</Field.FieldDescription
              >
            </Field.Field>
            <Alert.Root>
              <Info />
              <Alert.Description
                >Pick which album to show after setup, on the Storage tab.</Alert.Description
              >
            </Alert.Root>
          </Field.FieldGroup>
        {/if}
      </Card.Content>
      <Card.Footer class="justify-end">
        <Button type="submit" disabled={submitting}>
          {#if submitting}<Spinner data-icon="inline-start" />{/if}
          Create account & finish
        </Button>
      </Card.Footer>
    </Card.Root>
  </form>
</div>
