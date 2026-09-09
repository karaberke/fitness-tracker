<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatDuration, formatTime, plural, relativeDay } from '$lib/format';

	let { data } = $props();
	let starting = $state(false);
</script>

<svelte:head><title>Dashboard · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex items-end justify-between gap-4">
		<div>
			<div class="eyebrow text-accent">Hello, {data.user?.name}</div>
			<h1 class="mt-2 font-serif text-[42px] leading-[.94] tracking-[-.016em] text-ink">
				Fitness<br class="lg:hidden" /> Tracker
			</h1>
		</div>
		<form method="POST" action="?/logout" use:enhance class="lg:hidden">
			<Button type="submit" variant="ghost" size="sm">Sign out</Button>
		</form>
	</header>

	{#if data.active}
		<Card class="border-accent/40 bg-accent/5">
			<div class="eyebrow text-accent">Workout in progress</div>
			<div class="mt-2 font-serif text-3xl leading-tight text-ink">
				{data.active.title ?? 'Untitled workout'}
			</div>
			<div class="mt-1 text-sm text-ink-soft/70">
				Started {relativeDay(data.active.startedAt)} at {formatTime(data.active.startedAt)} ·
				{formatDuration(data.active.startedAt, null)} so far
			</div>
			<Button href="/workouts/{data.active.id}" size="lg" variant="accent" class="mt-5 w-full">
				Resume workout
			</Button>
		</Card>
	{:else}
		<form
			method="POST"
			action="?/start"
			use:enhance={() => {
				starting = true;
				return async ({ update }) => {
					starting = false;
					await update();
				};
			}}
		>
			<Button type="submit" size="lg" class="w-full" loading={starting} loadingText="Starting…">
				Start a workout
			</Button>
		</form>
	{/if}

	<div class="grid grid-cols-3 gap-3">
		<Card class="p-4">
			<div class="font-serif text-3xl leading-none text-ink">{data.stats.thisWeek}</div>
			<div class="mt-2 eyebrow text-ink-soft/60">This week</div>
		</Card>
		<Card class="p-4">
			<div class="font-serif text-3xl leading-none text-ink">{data.stats.total}</div>
			<div class="mt-2 eyebrow text-ink-soft/60">Workouts</div>
		</Card>
		<Card class="p-4">
			<div class="font-serif text-3xl leading-none text-ink">{data.exerciseCount}</div>
			<div class="mt-2 eyebrow text-ink-soft/60">Exercises</div>
		</Card>
	</div>

	<section class="flex flex-col gap-3">
		<div class="flex items-baseline justify-between">
			<h2 class="eyebrow text-ink-soft/70">Recent workouts</h2>
			<a href="/workouts" class="font-mono text-[11px] tracking-[.12em] text-accent uppercase">
				All history
			</a>
		</div>
		{#if data.recent.length === 0}
			<EmptyState
				title="No workouts yet"
				description="Start a workout, add an exercise and log your first set. It is saved as you go."
			/>
		{:else}
			<ul class="flex flex-col gap-3">
				{#each data.recent as w (w.id)}
					<li>
						<a
							href="/workouts/{w.id}"
							class="block rounded-3xl border border-ink-soft/12 bg-card p-5 transition-colors hover:bg-card-hover"
						>
							<div class="flex items-baseline justify-between gap-3">
								<div class="font-semibold text-ink">{w.title ?? 'Workout'}</div>
								<div class="font-mono text-[11px] text-ink-soft/60">{relativeDay(w.startedAt)}</div>
							</div>
							<div class="mt-1 truncate text-sm text-ink-soft/70">
								{w.exerciseNames.length ? w.exerciseNames.join(' · ') : 'No exercises'}
							</div>
							<div class="mt-2 font-mono text-[11px] tracking-[.08em] text-accent uppercase">
								{plural(w.setCount, 'set')} · {formatDuration(w.startedAt, w.finishedAt)}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="grid grid-cols-2 gap-3">
		<a
			href="/exercises"
			class="rounded-3xl border border-ink-soft/12 bg-card p-5 hover:bg-card-hover"
		>
			<div class="eyebrow text-accent">Catalog</div>
			<div class="mt-2 font-semibold text-ink">Exercises</div>
			<div class="mt-1 text-sm text-ink-soft/70">{plural(data.exerciseCount, 'exercise')}</div>
		</a>
		<a
			href="/machines"
			class="rounded-3xl border border-ink-soft/12 bg-card p-5 hover:bg-card-hover"
		>
			<div class="eyebrow text-accent">Catalog</div>
			<div class="mt-2 font-semibold text-ink">Machines</div>
			<div class="mt-1 text-sm text-ink-soft/70">{plural(data.machineCount, 'machine')}</div>
		</a>
	</section>
</div>
