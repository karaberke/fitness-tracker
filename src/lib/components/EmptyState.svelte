<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		children
	}: { title: string; description?: string; children?: Snippet } = $props();
</script>

<div
	class="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-ink-soft/25 px-6 py-10 text-center"
>
	<div class="font-serif text-2xl leading-tight text-ink">{title}</div>
	{#if description}
		<p class="max-w-xs text-sm text-ink-soft/70">{description}</p>
	{/if}
	{#if children}
		<div class="mt-1 flex flex-wrap justify-center gap-3">{@render children()}</div>
	{/if}
</div>
