<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import { Spinner } from '$lib/components/ui/spinner';
	import ImageIcon from '@lucide/svelte/icons/image';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<div class="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
	<div class="flex flex-col items-center gap-2 text-center">
		<div
			class="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl"
		>
			<ImageIcon />
		</div>
		<h1 class="text-xl font-semibold">Picture Frame</h1>
		<p class="text-muted-foreground text-sm">Sign in to your dashboard</p>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
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
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Root>
				{/if}
				<Field.FieldGroup>
					<Field.Field>
						<Field.FieldLabel for="username">Username</Field.FieldLabel>
						<Input id="username" name="username" value={form?.username ?? ''} required autofocus />
					</Field.Field>
					<Field.Field>
						<Field.FieldLabel for="password">Password</Field.FieldLabel>
						<Input id="password" name="password" type="password" required />
					</Field.Field>
					<Button type="submit" class="w-full" disabled={submitting}>
						{#if submitting}<Spinner data-icon="inline-start" />{/if}
						Sign in
					</Button>
				</Field.FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>
</div>
