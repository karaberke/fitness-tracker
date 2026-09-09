<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
</script>

<svelte:head><title>{page.status} · Fitness Tracker</title></svelte:head>

<main
	class="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center"
>
	<div class="eyebrow text-accent">Error {page.status}</div>
	<h1 class="font-serif text-4xl leading-tight text-ink">
		{page.status === 404 ? 'Nothing here' : 'Something went wrong'}
	</h1>
	<p class="text-ink-soft/70">{page.error?.message}</p>
	<Button href="/dashboard" variant="secondary">Back to dashboard</Button>
</main>
