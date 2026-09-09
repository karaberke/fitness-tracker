<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		back,
		children
	}: {
		eyebrow?: string;
		title: string;
		back?: { href: string; label: string };
		children?: Snippet;
	} = $props();
</script>

<header class="flex items-end justify-between gap-4">
	<div class="min-w-0">
		{#if back}
			<a
				href={back.href}
				class="mb-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-soft/15 bg-card pr-4 pl-3 font-mono text-[11px] tracking-[.1em] text-ink uppercase hover:bg-card-hover"
			>
				<span aria-hidden="true">&#8592;</span>
				{back.label}
			</a>
		{/if}
		{#if eyebrow}
			<div class="eyebrow text-accent">{eyebrow}</div>
		{/if}
		<h1
			class="mt-2 font-serif text-[38px] leading-[.95] tracking-[-.016em] text-ink lg:text-[44px]"
		>
			{title}
		</h1>
	</div>
	{#if children}
		<div class="flex flex-none items-center gap-2">{@render children()}</div>
	{/if}
</header>
