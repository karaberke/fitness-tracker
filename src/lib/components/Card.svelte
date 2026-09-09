<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		class: className = '',
		as = 'div',
		children
	}: {
		class?: ClassValue;
		as?: 'div' | 'section' | 'article' | 'li';
		children: Snippet;
	} = $props();
</script>

<svelte:element this={as} class={['rounded-3xl border border-ink-soft/12 bg-card p-5', className]}>
	{@render children()}
</svelte:element>
