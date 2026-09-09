<script lang="ts">
	import { dismiss, toasts } from '$lib/toast.svelte';

	const colors = {
		success: 'bg-ink text-card',
		error: 'bg-danger text-white',
		info: 'bg-accent text-white'
	} as const;
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toasts.list as t (t.id)}
		<button
			type="button"
			onclick={() => dismiss(t.id)}
			class={[
				'pointer-events-auto max-w-sm rounded-full px-5 py-3 text-sm font-medium shadow-[0_10px_30px_rgba(38,32,24,.25)]',
				colors[t.kind]
			]}
		>
			{t.message}
		</button>
	{/each}
</div>
