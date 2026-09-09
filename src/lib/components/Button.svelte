<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
	type Size = 'md' | 'lg' | 'sm';

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		loadingText = 'Saving…',
		formaction,
		name,
		value,
		class: className = '',
		onclick,
		children
	}: {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		loadingText?: string;
		formaction?: string;
		name?: string;
		value?: string;
		class?: ClassValue;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-ink text-card hover:bg-ink/90',
		accent: 'bg-accent text-white hover:bg-accent/90',
		secondary: 'border border-ink-soft/25 bg-card text-ink hover:bg-card-hover',
		ghost: 'text-ink hover:bg-ink-soft/8',
		danger: 'border border-danger/40 bg-card text-danger hover:bg-danger/8'
	};
	const sizes: Record<Size, string> = {
		lg: 'h-14 px-6 text-[13px] tracking-[.16em]',
		md: 'h-12 px-5 text-xs tracking-[.14em]',
		sm: 'h-10 px-4 text-[11px] tracking-[.12em]'
	};
	const classes = $derived([
		'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-mono font-medium uppercase whitespace-nowrap transition-colors active:opacity-80 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
		variants[variant],
		sizes[size],
		className
	]);
</script>

{#if href}
	<a {href} class={classes} aria-disabled={disabled || undefined}>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		{name}
		{value}
		{formaction}
		{onclick}
		disabled={disabled || loading}
		aria-busy={loading || undefined}
		class={classes}
	>
		{#if loading}
			<span
				class="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></span>
			{loadingText}
		{:else}
			{@render children()}
		{/if}
	</button>
{/if}
