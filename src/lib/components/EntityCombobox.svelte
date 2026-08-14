<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';

	interface Entity {
		entity_id: string;
		name: string;
	}

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select…',
		noneLabel = 'None',
		emptyLabel = 'No matches.'
	}: {
		items: Entity[];
		value: string;
		placeholder?: string;
		noneLabel?: string;
		emptyLabel?: string;
	} = $props();

	let open = $state(false);

	let selectedLabel = $derived(
		value ? (items.find((i) => i.entity_id === value)?.name ?? value) : noneLabel
	);

	function choose(id: string) {
		value = id;
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class="w-full justify-between font-normal"
			>
				<span class="truncate">{selectedLabel}</span>
				<ChevronsUpDown class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
		<Command.Root>
			<Command.Input {placeholder} />
			<Command.List class="max-h-64 overflow-y-auto">
				<Command.Empty>{emptyLabel}</Command.Empty>
				<Command.Group>
					<Command.Item value="__none__ none" onSelect={() => choose('')}>
						<Check class={cn('mr-2', value !== '' && 'text-transparent')} />
						{noneLabel}
					</Command.Item>
					{#each items as item (item.entity_id)}
						<Command.Item
							value={`${item.name} ${item.entity_id}`}
							onSelect={() => choose(item.entity_id)}
						>
							<Check class={cn('mr-2', value !== item.entity_id && 'text-transparent')} />
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
