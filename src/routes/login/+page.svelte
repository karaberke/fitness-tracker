<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';

	let {
		data,
		form
	}: { data: PageData; form: { email?: string; errors?: Record<string, string> } | null } =
		$props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Fitness Tracker</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
	<div class="mb-8">
		<div class="eyebrow text-accent">Self-hosted</div>
		<h1 class="mt-3 font-serif text-[46px] leading-[.94] tracking-[-.014em] text-ink">
			Fitness<br />Tracker
		</h1>
		<p class="mt-4 text-ink-soft/70">Sign in to log today's workout.</p>
	</div>

	<form
		method="POST"
		class="flex flex-col gap-5 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<input type="hidden" name="next" value={data.next} />
		{#if form?.errors?.form}
			<p class="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
				{form.errors.form}
			</p>
		{/if}
		<Field label="Email" name="email" error={form?.errors?.email}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					required
					value={form?.email ?? ''}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Password" name="password" error={form?.errors?.password}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="password"
					type="password"
					autocomplete="current-password"
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Button type="submit" size="lg" loading={busy} loadingText="Signing in…">Sign in</Button>
		<p class="text-center text-xs text-ink-soft/60">
			Accounts are created by the administrator. See the README.
		</p>
	</form>
</main>
