<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Field from '$lib/components/Field.svelte';
	import MachineLink from '$lib/components/MachineLink.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { announce } from '$lib/toast.svelte';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();
	let busy = $state(false);
	const ex = $derived(data.exercise);
	// svelte-ignore state_referenced_locally
	let usesMachine = $state(form?.values ? !!form.values.usesMachine : data.exercise.usesMachine);
	// svelte-ignore state_referenced_locally
	let machineId = $state(
		form?.values?.machineId ?? (data.exercise.machineId ? String(data.exercise.machineId) : '')
	);

	$effect(() => {
		announce(form, form?.message);
	});
</script>

<svelte:head><title>{ex.name} · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		eyebrow={ex.archivedAt ? 'Archived exercise' : 'Exercise'}
		title={ex.name}
		back={{ href: '/exercises', label: 'Exercises' }}
	/>

	{#if ex.machine}
		<section class="rounded-3xl border border-accent/30 bg-accent/5 p-5">
			<div class="eyebrow text-accent">Linked machine</div>
			<div class="mt-2 flex items-baseline justify-between gap-3">
				<a
					href="/machines/{ex.machine.id}"
					class="font-serif text-2xl text-ink underline-offset-4 hover:underline"
				>
					{ex.machine.name}
				</a>
				{#if ex.machine.gym}<span class="text-sm text-ink-soft/60">{ex.machine.gym}</span>{/if}
			</div>
			{#if ex.machine.model}<div class="mt-1 text-sm text-ink-soft/70">{ex.machine.model}</div>{/if}
			<div class="mt-4 rounded-2xl border border-ink-soft/12 bg-card p-4">
				<div class="eyebrow text-ink-soft/70">My setup</div>
				{#if data.mySetup}
					<div class="mt-2 font-mono text-[15px] text-ink">{data.mySetup.configuration}</div>
					{#if data.mySetup.notes}<div class="mt-1 text-sm text-ink-soft/70">
							{data.mySetup.notes}
						</div>{/if}
				{:else}
					<div class="mt-2 text-sm text-ink-soft/70">
						No personal setup saved for this machine yet.
					</div>
				{/if}
				<Button href="/machines/{ex.machine.id}" variant="secondary" size="sm" class="mt-3">
					{data.mySetup ? 'Edit my setup' : 'Save my setup'}
				</Button>
			</div>
			{#if ex.machine.archivedAt}
				<p class="mt-3 text-sm text-danger">
					This machine is archived, so it is no longer pre-selected.
				</p>
			{/if}
		</section>
	{/if}

	{#if ex.archivedAt}
		<form
			method="POST"
			action="?/restore"
			use:enhance
			class="rounded-3xl border border-ink-soft/12 bg-card p-5"
		>
			<p class="text-sm text-ink-soft/80">
				This exercise is archived: it is hidden from the picker but past workouts still show it.
			</p>
			<Button type="submit" variant="secondary" class="mt-4">Restore exercise</Button>
		</form>
	{/if}

	<form
		method="POST"
		action="?/update"
		class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<Field label="Name" name="name" error={form?.errors?.name}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="name"
					required
					maxlength="120"
					value={form?.values?.name ?? ex.name}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Muscle group" name="category" error={form?.errors?.category}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="category"
					maxlength="60"
					value={form?.values?.category ?? ex.category ?? ''}
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
				checked={form?.values ? !!form.values.isBodyweight : ex.isBodyweight}
				class="size-5 accent-accent"
			/>
			<span class="text-ink">Bodyweight exercise</span>
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
					rows="3"
					maxlength="2000"
					aria-describedby={describedBy}
					class={['field-input py-3', invalid && 'field-input-error']}
					>{form?.values?.notes ?? ex.notes ?? ''}</textarea
				>
			{/snippet}
		</Field>
		<Button type="submit" size="lg" loading={busy}>Save changes</Button>
	</form>

	{#if !ex.archivedAt}
		<div class="rounded-3xl border border-ink-soft/12 p-5">
			<h2 class="eyebrow text-ink-soft/70">Archive</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				Archiving hides the exercise from new workouts. Logged history is kept.
			</p>
			<div class="mt-4">
				<ConfirmAction
					action="?/archive"
					label="Archive exercise"
					confirmLabel="Yes, archive"
					question="Hide from new workouts?"
				/>
			</div>
		</div>
	{/if}
</div>
