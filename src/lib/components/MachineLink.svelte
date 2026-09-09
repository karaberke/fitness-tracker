<script lang="ts">
	import Field from './Field.svelte';

	/**
	 * "Uses a machine" checkbox that reveals a machine picker. Used by the
	 * create and edit exercise forms.
	 */
	let {
		machines,
		usesMachine = $bindable(false),
		machineId = $bindable(''),
		error
	}: {
		machines: { id: number; name: string; gym: string | null; archivedAt: Date | null }[];
		usesMachine?: boolean;
		machineId?: string;
		error?: string;
	} = $props();
</script>

<label
	class="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-ink-soft/20 px-4"
>
	<input
		type="checkbox"
		name="usesMachine"
		bind:checked={usesMachine}
		class="size-5 accent-accent"
	/>
	<span class="text-ink">Uses a machine</span>
	<span class="ml-auto text-xs text-ink-soft/60">links your machine setup</span>
</label>
{#if usesMachine}
	<Field
		label="Machine"
		name="machineId"
		{error}
		hint="Pre-selected when you add this exercise to a workout; you can still pick another one there."
	>
		{#snippet children({ id, describedBy, invalid })}
			<select
				{id}
				name="machineId"
				bind:value={machineId}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				class={['field-input', invalid && 'field-input-error']}
			>
				<option value="">Choose a machine…</option>
				{#each machines as m (m.id)}
					<option value={String(m.id)}>{m.name}{m.gym ? ` · ${m.gym}` : ''}</option>
				{/each}
			</select>
		{/snippet}
	</Field>
	{#if machines.length === 0}
		<p class="text-sm text-ink-soft/80">
			No machines yet. <a href="/machines" class="text-accent underline">Add one</a> first.
		</p>
	{/if}
{/if}
