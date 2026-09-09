<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';

	let { data, children } = $props();

	const tabs = $derived([
		{ href: '/dashboard', label: 'Home', icon: '⌂' },
		{
			href: data.activeWorkoutId ? `/workouts/${data.activeWorkoutId}` : '/workouts',
			label: data.activeWorkoutId ? 'Log' : 'History',
			icon: data.activeWorkoutId ? '●' : '≡',
			match: '/workouts'
		},
		{ href: '/exercises', label: 'Exercises', icon: '⚭' },
		{ href: '/machines', label: 'Machines', icon: '⚙' },
		{ href: '/settings', label: 'Settings', icon: '☺' }
	]);
	const isActive = (t: { href: string; match?: string }) =>
		page.url.pathname === t.href ||
		page.url.pathname.startsWith((t.match ?? t.href) + '/') ||
		(t.match !== undefined && page.url.pathname === t.match);
</script>

<div class="min-h-screen pb-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:pb-10">
	<!-- Desktop header -->
	<header class="hidden border-b border-ink-soft/12 bg-paper/90 backdrop-blur lg:block">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<a href="/dashboard" class="font-serif text-2xl tracking-[-.016em] text-ink"
				>Fitness Tracker</a
			>
			<nav class="flex items-center gap-1" aria-label="Main">
				{#each tabs as t (t.label)}
					<a
						href={t.href}
						aria-current={isActive(t) ? 'page' : undefined}
						class={[
							'rounded-full px-4 py-2 font-mono text-[11px] tracking-[.14em] uppercase',
							isActive(t) ? 'bg-ink text-card' : 'text-ink-soft/70 hover:bg-ink-soft/8'
						]}
					>
						{t.label}
					</a>
				{/each}
				<form method="POST" action="/dashboard?/logout" use:enhance class="ml-3">
					<button
						type="submit"
						class="cursor-pointer rounded-full px-4 py-2 font-mono text-[11px] tracking-[.14em] text-ink-soft/70 uppercase hover:bg-ink-soft/8"
					>
						Sign out · {data.user?.name}
					</button>
				</form>
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-8">
		{@render children()}
	</main>

	<!-- Mobile bottom tab bar -->
	<nav
		class="fixed inset-x-0 bottom-0 z-40 border-t border-ink-soft/12 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
		aria-label="Main"
	>
		<ul class="grid grid-cols-5">
			{#each tabs as t (t.label)}
				<li>
					<a
						href={t.href}
						aria-current={isActive(t) ? 'page' : undefined}
						class={[
							'flex h-16 flex-col items-center justify-center gap-1',
							isActive(t) ? 'text-accent' : 'text-ink-soft/60'
						]}
					>
						<span class="text-lg leading-none" aria-hidden="true">{t.icon}</span>
						<span class="font-mono text-[10px] tracking-[.12em] uppercase">{t.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
