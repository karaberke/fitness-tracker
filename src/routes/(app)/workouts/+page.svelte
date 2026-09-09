<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { dayKey, formatDuration, formatLongDate, formatTime, groupBy, plural } from '$lib/format';

	let { data } = $props();

	const days = $derived(
		groupBy(data.workouts, (w) => dayKey(w.startedAt)).map(([key, items]) => ({
			key,
			date: items[0].startedAt,
			items
		}))
	);
</script>

<svelte:head><title>History · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader eyebrow="Your log" title="History">
		{#if !data.activeWorkoutId}
			<form method="POST" action="?/start" use:enhance>
				<Button type="submit" variant="secondary">+ Start</Button>
			</form>
		{/if}
	</PageHeader>

	{#if days.length === 0}
		<EmptyState
			title="Nothing logged yet"
			description="Your finished and in-progress workouts will appear here by date."
		>
			<form method="POST" action="?/start" use:enhance>
				<Button type="submit">Start a workout</Button>
			</form>
		</EmptyState>
	{:else}
		{#each days as day (day.key)}
			<section>
				<h2 class="mb-3 eyebrow text-ink-soft/70">{formatLongDate(day.date)}</h2>
				<ul class="flex flex-col gap-3">
					{#each day.items as w (w.id)}
						<li>
							<a
								href="/workouts/{w.id}"
								class={[
									'block rounded-3xl border bg-card p-5 hover:bg-card-hover',
									w.finishedAt ? 'border-ink-soft/12' : 'border-accent/50 bg-accent/5'
								]}
							>
								<div class="flex items-baseline justify-between gap-3">
									<div class="font-semibold text-ink">{w.title ?? 'Workout'}</div>
									<div class="font-mono text-[11px] text-ink-soft/60">
										{formatTime(w.startedAt)} · {formatDuration(w.startedAt, w.finishedAt)}
									</div>
								</div>
								<div class="mt-1 text-sm text-ink-soft/70">
									{w.exerciseNames.length ? w.exerciseNames.join(' · ') : 'No exercises yet'}
								</div>
								<div class="mt-2 font-mono text-[11px] tracking-[.08em] text-accent uppercase">
									{#if !w.finishedAt}In progress ·
									{/if}{plural(w.exerciseCount, 'exercise')} · {plural(w.setCount, 'set')}
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</div>
