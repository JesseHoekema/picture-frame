<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import * as Alert from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { toast } from 'svelte-sonner';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Upload from '@lucide/svelte/icons/upload';
	import Lock from '@lucide/svelte/icons/lock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let files = $state<FileList | null>(null);
	let uploading = $state(false);
	let uploadedTotal = $state(0);

	let fileCount = $derived(files?.length ?? 0);
</script>

<svelte:head><title>Add photos · {data.name}</title></svelte:head>

<div class="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-6 p-6">
	<div class="flex flex-col items-center gap-2 text-center">
		<div class="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
			<ImageIcon />
		</div>
		<h1 class="text-xl font-semibold">Add photos</h1>
		<p class="text-muted-foreground text-sm">Your pictures will appear on the frame "{data.name}".</p>
	</div>

	{#if !data.enabled}
		<Alert.Root variant="destructive">
			<TriangleAlert />
			<Alert.Title>This link is disabled</Alert.Title>
			<Alert.Description>The owner has turned off uploads for this link.</Alert.Description>
		</Alert.Root>
	{:else if data.hasPassword && !data.unlocked}
		<!-- Password gate -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2"><Lock class="size-4" /> Password required</Card.Title>
				<Card.Description>Enter the password shared with you.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/unlock"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								await invalidateAll();
								toast.success('Unlocked');
							} else if (result.type === 'failure') {
								toast.error((result.data as { error?: string })?.error ?? 'Incorrect password');
							}
						};
					}}
				>
					<Field.FieldGroup>
						<Field.Field>
							<Field.FieldLabel for="password">Password</Field.FieldLabel>
							<Input id="password" name="password" type="password" required autofocus />
						</Field.Field>
						<Button type="submit" class="w-full">Unlock</Button>
					</Field.FieldGroup>
				</form>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Upload -->
		<Card.Root>
			<Card.Content class="pt-6">
				{#if uploadedTotal > 0}
					<Alert.Root class="mb-4">
						<CircleCheck class="text-green-600" />
						<Alert.Title>Thank you!</Alert.Title>
						<Alert.Description>
							{uploadedTotal} photo{uploadedTotal === 1 ? '' : 's'} added. You can add more below.
						</Alert.Description>
					</Alert.Root>
				{/if}

				<form
					method="POST"
					action="?/upload"
					enctype="multipart/form-data"
					use:enhance={() => {
						uploading = true;
						return async ({ result }) => {
							uploading = false;
							if (result.type === 'success') {
								const d = result.data as { uploaded?: number } | undefined;
								uploadedTotal += d?.uploaded ?? 0;
								files = null;
								toast.success(`Uploaded ${d?.uploaded ?? 0} photo(s)`);
							} else if (result.type === 'failure') {
								toast.error((result.data as { error?: string })?.error ?? 'Upload failed');
							}
						};
					}}
				>
					<Field.FieldGroup>
						<label
							for="files"
							class="border-input hover:bg-accent flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors"
						>
							<Upload class="text-muted-foreground size-8" />
							<span class="font-medium">Tap to choose photos</span>
							<span class="text-muted-foreground text-sm">
								{fileCount > 0 ? `${fileCount} selected` : 'JPG, PNG, WEBP, GIF · up to 30 MB each'}
							</span>
						</label>
						<input
							id="files"
							name="files"
							type="file"
							accept="image/*"
							multiple
							class="hidden"
							bind:files
						/>
						<Button type="submit" class="w-full" disabled={uploading || fileCount === 0}>
							{#if uploading}<Spinner data-icon="inline-start" />{:else}<Upload data-icon="inline-start" />{/if}
							Upload {fileCount > 0 ? `${fileCount} photo${fileCount === 1 ? '' : 's'}` : ''}
						</Button>
					</Field.FieldGroup>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
