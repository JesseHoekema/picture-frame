<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';

	interface Entity {
		entity_id: string;
		name: string;
	}

	let {
		items,
		value = $bindable([]),
		placeholder = 'Search entities…',
		addLabel = 'Add entity'
	}: {
		items: Entity[];
		value: string[];
		placeholder?: string;
		addLabel?: string;
	} = $props();

	let open = $state(false);

	function nameOf(id: string) {
		return items.find((i) => i.entity_id === id)?.name ?? id;
	}
	function toggle(id: string) {
		value = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
	}
	function remove(id: string) {
		value = value.filter((x) => x !== id);
	}
</script>

<div class="flex flex-col gap-2">
	{#if value.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each value as id (id)}
				<Badge variant="secondary" class="gap-1 py-1 pr-1">
					{nameOf(id)}
					<button
						type="button"
						onclick={() => remove(id)}
						class="hover:bg-background/60 rounded-full p-0.5"
						aria-label="Remove"
					>
						<X class="size-3" />
					</button>
				</Badge>
			{/each}
		</div>
	{/if}

	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" class="w-full justify-between font-normal">
					<span class="text-muted-foreground flex items-center gap-2">
						<Plus class="size-4" />
						{addLabel}
					</span>
					<ChevronsUpDown class="opacity-50" />
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
			<Command.Root>
				<Command.Input {placeholder} />
				<Command.List class="max-h-64 overflow-y-auto">
					<Command.Empty>No matches.</Command.Empty>
					<Command.Group>
						{#each items as item (item.entity_id)}
							<Command.Item
								value={`${item.name} ${item.entity_id}`}
								onSelect={() => toggle(item.entity_id)}
							>
								<Check
									class={cn('mr-2', !value.includes(item.entity_id) && 'text-transparent')}
								/>
								<div class="flex min-w-0 flex-col">
									<span class="truncate">{item.name}</span>
									<span class="text-muted-foreground truncate text-xs">{item.entity_id}</span>
								</div>
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>
