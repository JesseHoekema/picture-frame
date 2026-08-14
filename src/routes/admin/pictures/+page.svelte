<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { FrameImage } from '$lib/server/images';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import * as Alert from '$lib/components/ui/alert';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Spinner } from '$lib/components/ui/spinner';
	import { toast } from 'svelte-sonner';
	import Upload from '@lucide/svelte/icons/upload';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data }: { data: PageData } = $props();

	let items = $state<FrameImage[]>([]);
	let signature = $state('');
	$effect(() => {
		const sig = data.images.map((i) => i.id).join(',');
		if (sig !== signature) {
			signature = sig;
			items = [...data.images];
		}
	});

	let canReorder = $derived(data.backend !== 'immich');

	let fileInput: HTMLInputElement;
	let uploadForm: HTMLFormElement;
	let reorderForm: HTMLFormElement;
	let orderInput: HTMLInputElement;
	let uploading = $state(false);
	let dragIndex = $state<number | null>(null);

	function persistOrder() {
		orderInput.value = items.map((i) => i.id).join(',');
		reorderForm.requestSubmit();
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= items.length) return;
		const next = [...items];
		[next[index], next[target]] = [next[target], next[index]];
		items = next;
		persistOrder();
	}

	function onDrop(index: number) {
		if (dragIndex === null || dragIndex === index) return;
		const next = [...items];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(index, 0, moved);
		items = next;
		dragIndex = null;
		persistOrder();
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Pictures</h1>
			<p class="text-muted-foreground text-sm">
				{items.length} photo{items.length === 1 ? '' : 's'}{canReorder
					? ' · drag to reorder the slideshow'
					: ' · shown in album order'}
			</p>
		</div>
		<Button onclick={() => fileInput.click()} disabled={uploading || !data.storageConfigured}>
			{#if uploading}<Spinner data-icon="inline-start" />{:else}<Upload
					data-icon="inline-start"
				/>{/if}
			Upload
		</Button>
	</div>

	{#if !data.storageConfigured}
		<Alert.Root variant="destructive">
			<TriangleAlert />
			<Alert.Title>Storage not configured</Alert.Title>
			<Alert.Description>
				Finish setting up storage in <a class="underline" href="/admin/settings">Settings</a> before
				uploading.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Hidden upload form -->
	<form
		bind:this={uploadForm}
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		class="hidden"
		use:enhance={() => {
			uploading = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				uploading = false;
				fileInput.value = '';
				if (result.type === 'success') {
					const d = result.data as { uploaded?: number } | undefined;
					toast.success(`Uploaded ${d?.uploaded ?? 0} photo(s)`);
				} else if (result.type === 'failure') {
					toast.error((result.data as { error?: string })?.error ?? 'Upload failed');
				}
			};
		}}
	>
		<input
			bind:this={fileInput}
			name="files"
			type="file"
			accept="image/*"
			multiple
			onchange={() => uploadForm.requestSubmit()}
		/>
	</form>

	<!-- Hidden reorder form -->
	<form
		bind:this={reorderForm}
		method="POST"
		action="?/reorder"
		class="hidden"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					await invalidateAll();
				} else {
					toast.error('Could not save order');
				}
			};
		}}
	>
		<input bind:this={orderInput} name="order" type="hidden" />
	</form>

	{#if items.length === 0}
		<Empty.Root class="border-border rounded-xl border border-dashed py-16">
			<Empty.Header>
				<Empty.Media variant="icon">
					<ImagesIcon />
				</Empty.Media>
				<Empty.Title>No pictures yet</Empty.Title>
				<Empty.Description>Upload photos or share an upload link with others.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button onclick={() => fileInput.click()} disabled={!data.storageConfigured}>
					<Upload data-icon="inline-start" />
					Upload photos
				</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each items as image, index (image.id)}
				<Card.Root
					class="group relative overflow-hidden p-0"
					draggable={canReorder}
					ondragstart={() => canReorder && (dragIndex = index)}
					ondragover={(e) => canReorder && e.preventDefault()}
					ondrop={() => canReorder && onDrop(index)}
				>
					<div class="bg-muted relative aspect-square">
						<img
							src={`/api/media/${image.id}`}
							alt={image.original_name ?? ''}
							class="size-full object-cover"
							loading="lazy"
						/>
						<Badge class="absolute left-2 top-2 tabular-nums" variant="secondary">
							{index + 1}
						</Badge>
						{#if canReorder}
							<div
								class="absolute right-2 top-2 cursor-grab rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
							>
								<GripVertical class="size-4" />
							</div>
						{/if}
						<div
							class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<div class="flex gap-1">
								{#if canReorder}
									<Button
										size="icon"
										variant="secondary"
										class="size-7"
										disabled={index === 0}
										onclick={() => move(index, -1)}
										aria-label="Move earlier"
									>
										<ArrowUp />
									</Button>
									<Button
										size="icon"
										variant="secondary"
										class="size-7"
										disabled={index === items.length - 1}
										onclick={() => move(index, 1)}
										aria-label="Move later"
									>
										<ArrowDown />
									</Button>
								{/if}
							</div>
							<AlertDialog.Root>
								<AlertDialog.Trigger
									class="bg-destructive text-white hover:bg-destructive/90 inline-flex size-7 items-center justify-center rounded-md"
									aria-label="Delete"
								>
									<Trash2 class="size-4" />
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Delete this picture?</AlertDialog.Title>
										<AlertDialog.Description>
											This removes it from the slideshow and deletes it from storage. This cannot be
											undone.
										</AlertDialog.Description>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
										<form
											method="POST"
											action="?/delete"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														await invalidateAll();
														toast.success('Picture deleted');
													} else {
														toast.error('Delete failed');
													}
												};
											}}
										>
											<input type="hidden" name="id" value={image.id} />
											<AlertDialog.Action type="submit">Delete</AlertDialog.Action>
										</form>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>
						</div>
					</div>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
