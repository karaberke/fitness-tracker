<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Field from '$lib/components/Field.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SetForm from '$lib/components/SetForm.svelte';
	import { describeSet, formatDuration, formatLongDate, formatTime, plural } from '$lib/format';
	import { notify } from '$lib/toast.svelte';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();

	const w = $derived(data.workout);
	const active = $derived(!w.finishedAt);

	// Which block/set has its editor open (client-side UI state only).
	let editingBlock = $state<number | null>(null);
	let editingSet = $state<number | null>(null);
	let showAddExercise = $state(false);
	let showDetails = $state(false);
	let busy = $state<string | null>(null);

	// Add-exercise form state: pick a machine → pre-fill the configuration from personal defaults.
	let newExerciseId = $state('');
	let newMachineId = $state('');
	let newConfig = $state('');
	let lastAutoConfig = '';
	function onMachineChange() {
		const def = newMachineId ? (data.myDefaults[newMachineId] ?? '') : '';
		if (!newConfig || newConfig === lastAutoConfig) newConfig = def;
		lastAutoConfig = def;
	}
	let lastAutoMachine = '';
	function onExerciseChange() {
		const ex = data.exercises.find((e) => String(e.id) === newExerciseId);
		const linked =
			ex?.machineId != null && data.machines.some((m) => m.id === ex.machineId)
				? String(ex.machineId)
				: '';
		if (!newMachineId || newMachineId === lastAutoMachine) {
			newMachineId = linked;
			onMachineChange();
		}
		lastAutoMachine = linked;
	}

	$effect(() => {
		if (form?.message) notify(form.message);
		if (form?.intent === 'addExercise' && !form.errors) {
			showAddExercise = false;
			newExerciseId = '';
			newMachineId = '';
			newConfig = '';
		}
		if (form?.intent === 'updateBlock' && !form.errors) editingBlock = null;
		if (form?.intent === 'updateSet' && !form.errors) editingSet = null;
		if (form?.errors) {
			if (form.intent === 'addExercise') showAddExercise = true;
			if (form.intent === 'updateBlock') editingBlock = form.id ?? null;
			if (form.intent === 'updateSet') editingSet = form.id ?? null;
			if (form.intent === 'saveDetails') showDetails = true;
			if (form.intent === 'reopen' && form.errors.workout)
				notify(form.errors.workout, 'error', 5000);
		}
	});

	const errorsFor = (intent: string, id?: number) =>
		form?.intent === intent && (id === undefined || form.id === id) ? form.errors : undefined;

	const selectedExercise = $derived(data.exercises.find((e) => String(e.id) === newExerciseId));

	function initialFor(block: (typeof w.exercises)[number]) {
		const last = block.sets.at(-1) ?? data.previous[block.id]?.at(-1);
		return last
			? { reps: last.reps, weight: last.weight, unit: last.unit }
			: { reps: block.exercise.isBodyweight ? 8 : 10, weight: 0, unit: 'kg' };
	}

	async function scrollTo(id: string) {
		await tick();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head><title>{w.title ?? 'Workout'} · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		eyebrow={active ? 'In progress' : 'Finished'}
		title={w.title ?? 'Workout'}
		back={{ href: '/workouts', label: 'History' }}
	>
		<Button variant="ghost" size="sm" onclick={() => (showDetails = !showDetails)}>
			{showDetails ? 'Close' : 'Notes'}
		</Button>
	</PageHeader>

	<p class="-mt-2 font-mono text-[12px] text-ink-soft/70">
		{formatLongDate(w.startedAt)} · {formatTime(w.startedAt)}
		{#if w.finishedAt}– {formatTime(w.finishedAt)}{/if}
		· {formatDuration(w.startedAt, w.finishedAt)}
	</p>

	{#if showDetails || w.notes}
		<form
			method="POST"
			action="?/saveDetails"
			class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
			use:enhance={() => {
				busy = 'details';
				return async ({ update }) => {
					busy = null;
					await update({ reset: false });
				};
			}}
		>
			<Field label="Title" name="title" error={errorsFor('saveDetails')?.title}>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						name="title"
						maxlength="120"
						placeholder="Push day"
						value={form?.intent === 'saveDetails' ? (form.values?.title ?? '') : (w.title ?? '')}
						aria-describedby={describedBy}
						class={['field-input', invalid && 'field-input-error']}
					/>
				{/snippet}
			</Field>
			<Field label="Workout notes" name="notes" error={errorsFor('saveDetails')?.notes}>
				{#snippet children({ id, describedBy, invalid })}
					<textarea
						{id}
						name="notes"
						rows="3"
						maxlength="5000"
						placeholder="How did it go?"
						aria-describedby={describedBy}
						class={['field-input py-3', invalid && 'field-input-error']}
						>{form?.intent === 'saveDetails'
							? (form.values?.notes ?? '')
							: (w.notes ?? '')}</textarea
					>
				{/snippet}
			</Field>
			<Button type="submit" variant="secondary" loading={busy === 'details'}>Save notes</Button>
		</form>
	{/if}

	{#if w.exercises.length === 0 && !showAddExercise}
		<div class="rounded-3xl border border-dashed border-ink-soft/25 px-6 py-8 text-center">
			<div class="font-serif text-2xl text-ink">No exercises yet</div>
			<p class="mt-2 text-sm text-ink-soft/70">
				Add an exercise, pick the machine and start logging sets.
			</p>
		</div>
	{/if}

	{#each w.exercises as block, i (block.id)}
		{@const setErrors = errorsFor('addSet', block.id)}
		<section id="block-{block.id}" class="rounded-3xl border border-ink-soft/12 bg-card p-4 sm:p-5">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="eyebrow text-accent">
						{String(i + 1).padStart(2, '0')}{block.exercise.category
							? ` · ${block.exercise.category}`
							: ''}
					</div>
					<h2 class="mt-1.5 font-serif text-[28px] leading-none text-ink">{block.exercise.name}</h2>
					<div class="mt-2 text-sm text-ink-soft/80">
						{#if block.machine}
							<span class="font-medium text-ink">{block.machine.name}</span>
							{#if block.machine.gym}<span class="text-ink-soft/60">
									· {block.machine.gym}</span
								>{/if}
							{#if block.machineConfiguration}
								<div class="mt-0.5 font-mono text-[12px] text-ink-soft/80">
									{block.machineConfiguration}
								</div>
							{:else}
								<div class="mt-0.5 font-mono text-[12px] text-ink-soft/50">
									No configuration recorded
								</div>
							{/if}
						{:else}
							<span class="text-ink-soft/60"
								>{block.exercise.isBodyweight ? 'Bodyweight' : 'No machine'}</span
							>
						{/if}
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onclick={() => (editingBlock = editingBlock === block.id ? null : block.id)}
				>
					{editingBlock === block.id ? 'Close' : 'Setup'}
				</Button>
			</div>

			{#if editingBlock === block.id}
				{@const be = errorsFor('updateBlock', block.id)}
				<form
					method="POST"
					action="?/updateBlock"
					class="mt-4 flex flex-col gap-3 rounded-2xl border border-ink-soft/12 bg-paper p-3"
					use:enhance={() => {
						busy = `block-${block.id}`;
						return async ({ update }) => {
							busy = null;
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="workoutExerciseId" value={block.id} />
					<Field label="Machine" name="machineId" error={be?.machineId}>
						{#snippet children({ id, describedBy, invalid })}
							<select
								{id}
								name="machineId"
								aria-describedby={describedBy}
								class={['field-input', invalid && 'field-input-error']}
							>
								<option value="">No machine</option>
								{#each data.machines as m (m.id)}
									<option value={m.id} selected={m.id === block.machineId}
										>{m.name}{m.gym ? ` · ${m.gym}` : ''}</option
									>
								{/each}
								{#if block.machine?.archivedAt}
									<option value={block.machine.id} selected>{block.machine.name} (archived)</option>
								{/if}
							</select>
						{/snippet}
					</Field>
					<Field
						label="Configuration for the next sets"
						name="machineConfiguration"
						error={be?.machineConfiguration}
						hint="Sets already logged keep the configuration they were saved with."
					>
						{#snippet children({ id, describedBy, invalid })}
							<input
								{id}
								name="machineConfiguration"
								maxlength="500"
								placeholder="Seat 4 · Backrest 2"
								value={block.machineConfiguration ?? ''}
								aria-describedby={describedBy}
								class={['field-input', invalid && 'field-input-error']}
							/>
						{/snippet}
					</Field>
					<Field label="Exercise notes" name="notes" error={be?.notes}>
						{#snippet children({ id, describedBy, invalid })}
							<input
								{id}
								name="notes"
								maxlength="2000"
								value={block.notes ?? ''}
								aria-describedby={describedBy}
								class={['field-input', invalid && 'field-input-error']}
							/>
						{/snippet}
					</Field>
					<div class="flex flex-wrap items-center gap-2">
						<Button type="submit" loading={busy === `block-${block.id}`}>Save setup</Button>
						<div class="ml-auto">
							<ConfirmAction
								action="?/removeBlock"
								label="Remove exercise"
								size="sm"
								question="Remove this exercise and its sets?"
							>
								<input type="hidden" name="workoutExerciseId" value={block.id} />
							</ConfirmAction>
						</div>
					</div>
				</form>
			{/if}

			{#if block.notes}
				<p class="mt-3 text-sm text-ink-soft/80">{block.notes}</p>
			{/if}

			<!-- Sets -->
			<ol class="mt-4 flex flex-col divide-y divide-ink-soft/10 border-t border-ink-soft/10">
				{#each block.sets as s, si (s.id)}
					<li class="py-2">
						{#if editingSet === s.id}
							<div class="py-1">
								<SetForm
									action="?/updateSet"
									hidden={{ setId: s.id }}
									initial={{ reps: s.reps, weight: s.weight, unit: s.unit }}
									bodyweight={block.exercise.isBodyweight}
									errors={errorsFor('updateSet', s.id)}
									submitLabel="Update"
									oncancel={() => (editingSet = null)}
								/>
								<form method="POST" action="?/deleteSet" class="mt-2 flex justify-end" use:enhance>
									<input type="hidden" name="setId" value={s.id} />
									<Button type="submit" variant="danger" size="sm">Remove set</Button>
								</form>
							</div>
						{:else}
							<div class="flex min-h-12 items-center gap-3">
								<span class="w-8 font-mono text-[11px] text-ink-soft/50">#{si + 1}</span>
								<span class="font-mono text-lg text-ink">{describeSet(s)}</span>
								{#if block.machineId && s.machineConfiguration && s.machineConfiguration !== block.machineConfiguration}
									<span
										class="truncate font-mono text-[11px] text-ink-soft/60"
										title="Configuration used for this set">{s.machineConfiguration}</span
									>
								{/if}
								<button
									type="button"
									onclick={() => (editingSet = s.id)}
									class="ml-auto h-10 cursor-pointer rounded-full px-3 font-mono text-[11px] tracking-[.12em] text-ink-soft/70 uppercase hover:bg-ink-soft/8"
								>
									Edit
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ol>

			{#if block.sets.length === 0 && data.previous[block.id]}
				<p class="mt-3 font-mono text-[12px] text-ink-soft/60">
					Last time: {data.previous[block.id].map(describeSet).join(' · ')}
				</p>
			{/if}

			{#if active}
				<div class="mt-3">
					{#key block.sets.length}
						<SetForm
							action="?/addSet"
							hidden={{ workoutExerciseId: block.id }}
							initial={initialFor(block)}
							bodyweight={block.exercise.isBodyweight}
							errors={setErrors}
							submitLabel={`Log set ${block.sets.length + 1}`}
						/>
					{/key}
				</div>
			{/if}
		</section>
	{/each}

	{#if active}
		{#if showAddExercise}
			{@const ae = errorsFor('addExercise')}
			<form
				method="POST"
				action="?/addExercise"
				id="add-exercise"
				class="flex flex-col gap-4 rounded-3xl border border-accent/40 bg-card p-5"
				use:enhance={() => {
					busy = 'addExercise';
					return async ({ update }) => {
						busy = null;
						await update({ reset: false });
					};
				}}
			>
				<h2 class="font-serif text-2xl text-ink">Add exercise</h2>
				{#if data.exercises.length === 0}
					<p class="text-sm text-ink-soft/80">
						The catalog is empty. <a href="/exercises" class="text-accent underline"
							>Create an exercise</a
						> first.
					</p>
				{/if}
				<Field label="Exercise" name="exerciseId" error={ae?.exerciseId}>
					{#snippet children({ id, describedBy, invalid })}
						<select
							{id}
							name="exerciseId"
							required
							bind:value={newExerciseId}
							onchange={onExerciseChange}
							aria-describedby={describedBy}
							class={['field-input', invalid && 'field-input-error']}
						>
							<option value="" disabled>Choose an exercise…</option>
							{#each data.exercises as e (e.id)}
								<option value={String(e.id)}>{e.name}{e.category ? ` · ${e.category}` : ''}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field
					label="Machine"
					name="machineId"
					error={ae?.machineId}
					hint={selectedExercise?.machineId &&
					data.machines.some((m) => m.id === selectedExercise.machineId)
						? `Linked to ${data.machines.find((m) => m.id === selectedExercise.machineId)?.name}`
						: selectedExercise?.isBodyweight
							? 'Optional for bodyweight exercises'
							: 'Optional'}
				>
					{#snippet children({ id, describedBy, invalid })}
						<select
							{id}
							name="machineId"
							bind:value={newMachineId}
							onchange={onMachineChange}
							aria-describedby={describedBy}
							class={['field-input', invalid && 'field-input-error']}
						>
							<option value=""
								>{selectedExercise?.machineId ? 'Exercise default' : 'No machine'}</option
							>
							{#each data.machines as m (m.id)}
								<option value={String(m.id)}>{m.name}{m.gym ? ` · ${m.gym}` : ''}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				{#if newMachineId}
					<Field
						label="Configuration"
						name="machineConfiguration"
						error={ae?.machineConfiguration}
						hint={data.myDefaults[newMachineId]
							? 'Pre-filled from your saved setup'
							: 'Seat, backrest, attachment…'}
					>
						{#snippet children({ id, describedBy, invalid })}
							<input
								{id}
								name="machineConfiguration"
								maxlength="500"
								bind:value={newConfig}
								placeholder="Seat 4 · Backrest 2"
								aria-describedby={describedBy}
								class={['field-input', invalid && 'field-input-error']}
							/>
						{/snippet}
					</Field>
				{/if}
				<div class="flex gap-2">
					<Button
						type="submit"
						class="flex-1"
						loading={busy === 'addExercise'}
						loadingText="Adding…">Add to workout</Button
					>
					<Button variant="ghost" onclick={() => (showAddExercise = false)}>Cancel</Button>
				</div>
			</form>
		{:else}
			<Button
				variant="secondary"
				size="lg"
				class="w-full border-dashed border-accent/50 text-accent"
				onclick={() => {
					showAddExercise = true;
					scrollTo('add-exercise');
				}}
			>
				+ Add exercise
			</Button>
		{/if}
	{/if}

	<div class="mt-2 flex flex-col gap-3 rounded-3xl border border-ink-soft/12 p-5">
		{#if active}
			<form
				method="POST"
				action="?/finish"
				use:enhance={() => {
					busy = 'finish';
					return async ({ update }) => {
						busy = null;
						await update();
					};
				}}
			>
				<Button
					type="submit"
					size="lg"
					variant="accent"
					class="w-full"
					loading={busy === 'finish'}
					loadingText="Finishing…"
				>
					Finish workout
				</Button>
			</form>
			<p class="text-center text-xs text-ink-soft/60">
				{plural(w.exercises.length, 'exercise')} · {plural(
					w.exercises.reduce((n, b) => n + b.sets.length, 0),
					'set'
				)} · everything is already saved
			</p>
		{:else}
			<form method="POST" action="?/reopen" use:enhance>
				<Button type="submit" variant="secondary" size="lg" class="w-full"
					>Reopen to log more</Button
				>
			</form>
		{/if}
		<div class="flex justify-center">
			<ConfirmAction
				action="?/delete"
				label="Delete workout"
				question="Delete this workout and all its sets?"
			/>
		</div>
	</div>
</div>
