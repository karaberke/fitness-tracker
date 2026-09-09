<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Label + control + hint/error. The control snippet receives the ids it
	 * should use so the label and error text are associated for screen readers.
	 */
	let {
		label,
		name,
		error,
		hint,
		class: className = '',
		children
	}: {
		label: string;
		name: string;
		error?: string;
		hint?: string;
		class?: string;
		children: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
	} = $props();

	const id = $derived(`field-${name}-${Math.random().toString(36).slice(2, 7)}`);
	const describedBy = $derived(error ? `${id}-error` : hint ? `${id}-hint` : undefined);
</script>

<div class={['flex flex-col gap-2', className]}>
	<label for={id} class="eyebrow text-ink-soft/70">{label}</label>
	{@render children({ id, describedBy, invalid: !!error })}
	{#if error}
		<p id="{id}-error" class="text-sm text-danger" role="alert">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="text-sm text-ink-soft/60">{hint}</p>
	{/if}
</div>
