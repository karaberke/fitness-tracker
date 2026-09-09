<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Field from '$lib/components/Field.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { announce } from '$lib/toast.svelte';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();
	let savingMachine = $state(false);
	let savingSetting = $state(false);
	const m = $derived(data.machine);
	const settingErrors = $derived(form?.intent === 'setting' ? form.errors : undefined);
	const machineErrors = $derived(form?.intent === 'update' ? form.errors : undefined);
	const settingValues = $derived(form?.intent === 'setting' ? form.values : undefined);
	const machineValues = $derived(form?.intent === 'update' ? form.values : undefined);

	$effect(() => {
		announce(form, form?.message);
	});
</script>

<svelte:head><title>{m.name} · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		eyebrow={m.archivedAt ? 'Archived machine' : (m.gym ?? 'Machine')}
		title={m.name}
		back={{ href: '/machines', label: 'Machines' }}
	/>

	{#if m.archivedAt}
		<form
			method="POST"
			action="?/restore"
			use:enhance
			class="rounded-3xl border border-ink-soft/12 bg-card p-5"
		>
			<p class="text-sm text-ink-soft/80">
				This machine is archived: hidden from the picker, still shown in past workouts.
			</p>
			<Button type="submit" variant="secondary" class="mt-4">Restore machine</Button>
		</form>
	{/if}

	<!-- Personal defaults: private to the signed-in user -->
	<form
		method="POST"
		action="?/saveSetting"
		class="flex flex-col gap-4 rounded-3xl border border-accent/30 bg-accent/5 p-5"
		use:enhance={() => {
			savingSetting = true;
			return async ({ update }) => {
				savingSetting = false;
				await update({ reset: false });
			};
		}}
	>
		<div>
			<h2 class="eyebrow text-accent">My setup</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				Only you see this. It is copied into new workouts, so past logs never change when you edit
				it.
			</p>
		</div>
		<Field label="Configuration" name="configuration" error={settingErrors?.configuration}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="configuration"
					required
					maxlength="500"
					placeholder="Seat 4 · Backrest 2 · Rope"
					value={settingValues?.configuration ?? data.setting?.configuration ?? ''}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Notes" name="notes" error={settingErrors?.notes}>
			{#snippet children({ id, describedBy, invalid })}
				<textarea
					{id}
					name="notes"
					rows="2"
					maxlength="2000"
					placeholder="Optional reminders"
					aria-describedby={describedBy}
					class={['field-input py-3', invalid && 'field-input-error']}
					>{settingValues?.notes ?? data.setting?.notes ?? ''}</textarea
				>
			{/snippet}
		</Field>
		<div class="flex flex-wrap gap-2">
			<Button type="submit" variant="accent" loading={savingSetting}>Save my setup</Button>
			{#if data.setting}
				<Button type="submit" variant="ghost" formaction="?/clearSetting">Remove</Button>
			{/if}
		</div>
	</form>

	{#if data.exercises.length}
		<section class="rounded-3xl border border-ink-soft/12 bg-card p-5">
			<h2 class="eyebrow text-ink-soft/70">Exercises on this machine</h2>
			<ul class="mt-3 flex flex-col divide-y divide-ink-soft/10">
				{#each data.exercises as e (e.id)}
					<li>
						<a
							href="/exercises/{e.id}"
							class="flex min-h-12 items-center justify-between gap-3 hover:text-accent"
						>
							<span class="font-semibold">{e.name}</span>
							{#if e.category}<span class="text-sm text-ink-soft/60">{e.category}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<form
		method="POST"
		action="?/update"
		class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={() => {
			savingMachine = true;
			return async ({ update }) => {
				savingMachine = false;
				await update({ reset: false });
			};
		}}
	>
		<h2 class="eyebrow text-ink-soft/70">Machine details (shared)</h2>
		<Field label="Name" name="name" error={machineErrors?.name}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="name"
					required
					maxlength="120"
					value={machineValues?.name ?? m.name}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Gym" name="gym" error={machineErrors?.gym}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="gym"
					maxlength="120"
					value={machineValues?.gym ?? m.gym ?? ''}
					aria-describedby={describedBy}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Model" name="model" error={machineErrors?.model}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="model"
					maxlength="120"
					value={machineValues?.model ?? m.model ?? ''}
					aria-describedby={describedBy}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Notes" name="notes" error={machineErrors?.notes}>
			{#snippet children({ id, describedBy, invalid })}
				<textarea
					{id}
					name="notes"
					rows="3"
					maxlength="2000"
					aria-describedby={describedBy}
					class={['field-input py-3', invalid && 'field-input-error']}
					>{machineValues?.notes ?? m.notes ?? ''}</textarea
				>
			{/snippet}
		</Field>
		<Button type="submit" size="lg" loading={savingMachine}>Save changes</Button>
	</form>

	{#if !m.archivedAt}
		<div class="rounded-3xl border border-ink-soft/12 p-5">
			<h2 class="eyebrow text-ink-soft/70">Archive</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				Archiving hides the machine from new workouts. Logged history is kept.
			</p>
			<div class="mt-4">
				<ConfirmAction
					action="?/archive"
					label="Archive machine"
					confirmLabel="Yes, archive"
					question="Hide from new workouts?"
				/>
			</div>
		</div>
	{/if}
</div>
