<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Field from '$lib/components/Field.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { groupBy } from '$lib/format';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();
	let showForm = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (form?.errors) showForm = true;
	});

	const byGym = $derived(groupBy(data.machines, (m) => m.gym ?? 'No gym set'));
</script>

<svelte:head><title>Machines · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader eyebrow="Shared catalog" title="Machines">
		<Button variant="secondary" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Close' : '+ New'}
		</Button>
	</PageHeader>

	{#if showForm}
		<form
			method="POST"
			action="?/create"
			class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update();
				};
			}}
		>
			<h2 class="font-serif text-2xl text-ink">New machine</h2>
			<Field label="Name" name="name" error={form?.errors?.name}>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="name"
						required
						maxlength="120"
						placeholder="Chest press"
						value={form?.values?.name ?? ''}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<Field label="Gym" name="gym" error={form?.errors?.gym} hint="Where it lives">
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="gym"
						maxlength="120"
						placeholder="Downtown Gym"
						value={form?.values?.gym ?? ''}
						aria-describedby={describedBy}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<Field label="Model" name="model" error={form?.errors?.model}>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="model"
						maxlength="120"
						placeholder="Technogym Selection 700"
						value={form?.values?.model ?? ''}
						aria-describedby={describedBy}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<Field label="Notes" name="notes" error={form?.errors?.notes}>
				{#snippet children({ id, describedBy, invalid })}
					<textarea
						{id}
						name="notes"
						rows="2"
						maxlength="2000"
						aria-describedby={describedBy}
						class={['field-input py-3', invalid && 'field-input-error']}
						>{form?.values?.notes ?? ''}</textarea
					>
				{/snippet}
			</Field>
			<Button type="submit" size="lg" loading={busy}>Create machine</Button>
		</form>
	{/if}

	{#if data.machines.length === 0}
		<EmptyState
			title="No machines yet"
			description="Add the machines at your gym, then save your personal seat and backrest settings."
		>
			<Button onclick={() => (showForm = true)}>Add a machine</Button>
		</EmptyState>
	{:else}
		{#each byGym as [gym, list] (gym)}
			<section>
				<h2 class="mb-3 eyebrow text-ink-soft/70">{gym}</h2>
				<ul class="flex flex-col gap-2">
					{#each list as m (m.id)}
						<li>
							<a
								href="/machines/{m.id}"
								class="flex min-h-14 flex-col justify-center gap-1 rounded-2xl border border-ink-soft/12 bg-card px-5 py-3 hover:bg-card-hover"
							>
								<div class="flex items-baseline justify-between gap-3">
									<span class="font-semibold text-ink">{m.name}</span>
									{#if m.model}
										<span class="truncate text-xs text-ink-soft/60">{m.model}</span>
									{/if}
								</div>
								{#if m.myDefault}
									<div class="font-mono text-[11px] text-accent">My setup: {m.myDefault}</div>
								{:else}
									<div class="font-mono text-[11px] text-ink-soft/50">No personal setup saved</div>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}

	{#if data.archived.length}
		<details class="rounded-3xl border border-ink-soft/12 p-5">
			<summary class="cursor-pointer eyebrow text-ink-soft/70"
				>Archived ({data.archived.length})</summary
			>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.archived as m (m.id)}
					<li>
						<a href="/machines/{m.id}" class="block py-2 text-ink-soft/70 hover:text-ink">
							{m.name}{m.gym ? ` · ${m.gym}` : ''}
						</a>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>
