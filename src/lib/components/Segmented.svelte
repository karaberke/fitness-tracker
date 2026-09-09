<script lang="ts">
	/** Radio group styled as a segmented control (e.g. kg / lb). */
	let {
		name,
		options,
		value = $bindable(),
		label
	}: {
		name: string;
		options: { value: string; label: string }[];
		value?: string;
		label: string;
	} = $props();
</script>

<fieldset class="flex h-12 rounded-full border border-ink-soft/20 bg-card p-1">
	<legend class="sr-only">{label}</legend>
	{#each options as o (o.value)}
		<label
			class={[
				'flex flex-1 cursor-pointer items-center justify-center rounded-full font-mono text-xs font-medium tracking-[.12em] uppercase transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent',
				value === o.value ? 'bg-ink text-card' : 'text-ink-soft/70 hover:bg-card-hover'
			]}
		>
			<input type="radio" {name} value={o.value} bind:group={value} class="sr-only" />
			{o.label}
		</label>
	{/each}
</fieldset>
