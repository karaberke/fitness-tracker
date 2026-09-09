<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Field from '$lib/components/Field.svelte';
	import MachineLink from '$lib/components/MachineLink.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { groupBy } from '$lib/format';
	import { notify } from '$lib/toast.svelte';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();
	let showForm = $state(false);
	let busy = $state(false);
	let usesMachine = $state(false);
	let machineId = $state('');

	$effect(() => {
		if (form?.errors) {
			showForm = true;
			usesMachine = !!form.values?.usesMachine;
			machineId = form.values?.machineId ?? '';
		}
	});

	const groups = $derived(
		groupBy(data.exercises, (e) => e.category ?? 'Other').sort(([a], [b]) => a.localeCompare(b))
	);
</script>

<svelte:head><title>Exercises · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader eyebrow="Shared catalog" title="Exercises">
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
				return async ({ update, result }) => {
					busy = false;
					if (result.type === 'redirect') {
						showForm = false;
						notify('Exercise created');
					}
					await update();
				};
			}}
		>
			<h2 class="font-serif text-2xl text-ink">New exercise</h2>
			<Field label="Name" name="name" error={form?.errors?.name}>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="name"
						required
						maxlength="120"
						placeholder="Lat pulldown"
						value={form?.values?.name ?? ''}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<Field
				label="Muscle group"
				name="category"
				error={form?.errors?.category}
				hint="Optional, e.g. Back"
			>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="category"
						maxlength="60"
						placeholder="Back"
						value={form?.values?.category ?? ''}
						aria-describedby={describedBy}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<label
				class="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-ink-soft/20 px-4"
			>
				<input
					type="checkbox"
					name="isBodyweight"
					checked={!!form?.values?.isBodyweight}
					class="size-5 accent-accent"
				/>
				<span class="text-ink">Bodyweight exercise</span>
				<span class="ml-auto text-xs text-ink-soft/60">weight may be 0</span>
			</label>
			<MachineLink
				machines={data.machines}
				bind:usesMachine
				bind:machineId
				error={form?.errors?.machineId}
			/>
			<Field label="Notes" name="notes" error={form?.errors?.notes}>
				{#snippet children({ id, describedBy, invalid })}
					<textarea
						{id}
						name="notes"
						rows="2"
						maxlength="2000"
						placeholder="Cues, tempo, anything to remember"
						aria-describedby={describedBy}
						class={['field-input py-3', invalid && 'field-input-error']}
						>{form?.values?.notes ?? ''}</textarea
					>
				{/snippet}
			</Field>
			<Button type="submit" size="lg" loading={busy}>Create exercise</Button>
		</form>
	{/if}

	{#if data.exercises.length === 0}
		<EmptyState
			title="No exercises yet"
			description="Add the movements you do. Both accounts share this list."
		>
			<Button onclick={() => (showForm = true)}>Add your first exercise</Button>
		</EmptyState>
	{:else}
		{#each groups as [category, list] (category)}
			<section>
				<h2 class="mb-3 eyebrow text-ink-soft/70">{category}</h2>
				<ul class="flex flex-col gap-2">
					{#each list as e (e.id)}
						<li>
							<a
								href="/exercises/{e.id}"
								class={[
									'flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-3 hover:bg-card-hover',
									String(e.id) === page.url.searchParams.get('created')
										? 'border-accent'
										: 'border-ink-soft/12'
								]}
							>
								<span class="min-w-0">
									<span class="block font-semibold text-ink">{e.name}</span>
									{#if e.machine}
										<span class="block truncate font-mono text-[11px] text-ink-soft/60"
											>{e.machine.name}{e.machine.gym ? ` · ${e.machine.gym}` : ''}</span
										>
									{/if}
								</span>
								{#if e.isBodyweight}
									<span class="font-mono text-[10px] tracking-[.12em] text-accent uppercase"
										>Bodyweight</span
									>
								{:else if e.usesMachine}
									<span class="font-mono text-[10px] tracking-[.12em] text-accent uppercase"
										>Machine</span
									>
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
			<summary class="cursor-pointer eyebrow text-ink-soft/70">
				Archived ({data.archived.length})
			</summary>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.archived as e (e.id)}
					<li>
						<a href="/exercises/{e.id}" class="block py-2 text-ink-soft/70 hover:text-ink"
							>{e.name}</a
						>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>
