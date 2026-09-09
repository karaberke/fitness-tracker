<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import RoundButton from './RoundButton.svelte';
	import Segmented from './Segmented.svelte';

	/**
	 * Add or edit one set. Large +/- steppers so it is usable one-handed at the
	 * gym; the values are also plain inputs for typing.
	 */
	let {
		action,
		hidden = {},
		initial,
		bodyweight = false,
		errors,
		submitLabel = 'Save set',
		compact = false,
		oncancel,
		onsaved
	}: {
		action: string;
		hidden?: Record<string, string | number>;
		initial: { reps: number; weight: number; unit: string };
		bodyweight?: boolean;
		errors?: Record<string, string>;
		submitLabel?: string;
		compact?: boolean;
		oncancel?: () => void;
		onsaved?: () => void;
	} = $props();

	// The form owns its values after mount; parents re-create it ({#key}) to reset.
	// svelte-ignore state_referenced_locally
	let reps = $state(String(initial.reps));
	// svelte-ignore state_referenced_locally
	let weight = $state(initial.weight ? String(initial.weight) : bodyweight ? '0' : '');
	// svelte-ignore state_referenced_locally
	let unit = $state(initial.unit);
	let busy = $state(false);

	const weightStep = $derived(unit === 'lb' ? 5 : 2.5);
	const round = (n: number) => Math.round(n * 100) / 100;
	const bump = (field: 'reps' | 'weight', delta: number) => {
		if (field === 'reps') reps = String(Math.max(1, (parseInt(reps) || 0) + delta));
		else weight = String(Math.max(0, round((parseFloat(weight.replace(',', '.')) || 0) + delta)));
	};
</script>

<form
	method="POST"
	{action}
	class={[
		'flex flex-col gap-3',
		compact ? '' : 'rounded-2xl border border-ink-soft/12 bg-paper p-3'
	]}
	use:enhance={() => {
		busy = true;
		return async ({ update, result }) => {
			busy = false;
			await update({ reset: false });
			if (result.type === 'success') onsaved?.();
		};
	}}
>
	{#each Object.entries(hidden) as [k, v] (k)}
		<input type="hidden" name={k} value={v} />
	{/each}

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label
				for="reps-{hidden.workoutExerciseId ?? hidden.setId}-{compact}"
				class="eyebrow text-ink-soft/70">Reps</label
			>
			<div class="mt-2 flex items-center gap-1.5">
				<RoundButton
					label="Fewer reps"
					onclick={() => bump('reps', -1)}
					class="size-11 bg-card text-lg">&minus;</RoundButton
				>
				<input
					id="reps-{hidden.workoutExerciseId ?? hidden.setId}-{compact}"
					name="reps"
					type="number"
					inputmode="numeric"
					min="1"
					step="1"
					required
					bind:value={reps}
					aria-invalid={errors?.reps ? true : undefined}
					class={[
						'field-input min-w-0 px-2 text-center font-mono text-lg',
						errors?.reps && 'field-input-error'
					]}
				/>
				<RoundButton
					label="More reps"
					onclick={() => bump('reps', 1)}
					class="size-11 bg-card text-lg">+</RoundButton
				>
			</div>
			{#if errors?.reps}<p class="mt-1 text-xs text-danger" role="alert">{errors.reps}</p>{/if}
		</div>
		<div>
			<label
				for="weight-{hidden.workoutExerciseId ?? hidden.setId}-{compact}"
				class="eyebrow text-ink-soft/70"
			>
				{bodyweight ? 'Added weight' : 'Weight'}
			</label>
			<div class="mt-2 flex items-center gap-1.5">
				<RoundButton
					label="Less weight"
					onclick={() => bump('weight', -weightStep)}
					class="size-11 bg-card text-lg">&minus;</RoundButton
				>
				<input
					id="weight-{hidden.workoutExerciseId ?? hidden.setId}-{compact}"
					name="weight"
					type="number"
					inputmode="decimal"
					min="0"
					step="0.25"
					placeholder={bodyweight ? '0' : '50'}
					bind:value={weight}
					aria-invalid={errors?.weight ? true : undefined}
					class={[
						'field-input min-w-0 px-2 text-center font-mono text-lg',
						errors?.weight && 'field-input-error'
					]}
				/>
				<RoundButton
					label="More weight"
					onclick={() => bump('weight', weightStep)}
					class="size-11 bg-card text-lg">+</RoundButton
				>
			</div>
			{#if errors?.weight}<p class="mt-1 text-xs text-danger" role="alert">{errors.weight}</p>{/if}
		</div>
	</div>

	<div class="grid grid-cols-[minmax(7rem,1fr)_2fr] items-center gap-3">
		<Segmented
			name="unit"
			label="Unit"
			bind:value={unit}
			options={[
				{ value: 'kg', label: 'kg' },
				{ value: 'lb', label: 'lb' }
			]}
		/>
		<div class="flex items-center gap-2">
			<Button type="submit" class="flex-1" loading={busy}>{submitLabel}</Button>
			{#if oncancel}
				<Button variant="ghost" onclick={oncancel}>Cancel</Button>
			{/if}
		</div>
	</div>
	{#if errors?.unit}<p class="text-xs text-danger" role="alert">{errors.unit}</p>{/if}
</form>
