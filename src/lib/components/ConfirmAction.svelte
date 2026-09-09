<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	/**
	 * Two-step destructive action that works without JavaScript: the first tap
	 * opens the confirmation, the second submits the form action.
	 */
	let {
		action,
		label,
		confirmLabel = 'Yes, delete',
		question = 'This cannot be undone.',
		variant = 'danger',
		size = 'md',
		onsuccess,
		children
	}: {
		action: string;
		label: string;
		confirmLabel?: string;
		question?: string;
		variant?: 'danger' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		onsuccess?: () => void;
		children?: Snippet;
	} = $props();

	let open = $state(false);
	let busy = $state(false);
</script>

{#if !open}
	<Button {variant} {size} onclick={() => (open = true)}>{label}</Button>
{:else}
	<form
		method="POST"
		{action}
		class="flex flex-wrap items-center gap-2"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				busy = false;
				open = false;
				if (result.type === 'success' || result.type === 'redirect') onsuccess?.();
				await update();
			};
		}}
	>
		{#if children}{@render children()}{/if}
		<span class="text-sm text-ink-soft/80">{question}</span>
		<Button type="submit" variant="danger" {size} loading={busy} loadingText="Deleting…">
			{confirmLabel}
		</Button>
		<Button variant="ghost" {size} onclick={() => (open = false)}>Cancel</Button>
	</form>
{/if}
