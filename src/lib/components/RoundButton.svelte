<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		label,
		onclick,
		class: className = '',
		children
	}: { label: string; onclick: () => void; class?: ClassValue; children: Snippet } = $props();
</script>

<button
	type="button"
	aria-label={label}
	{onclick}
	class={[
		'flex flex-none cursor-pointer items-center justify-center rounded-full border border-ink-soft/14 font-mono leading-none text-ink active:opacity-60',
		className
	]}
>
	{@render children()}
</button>
