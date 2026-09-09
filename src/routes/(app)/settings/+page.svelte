<script lang="ts">
	import type { PageData } from './$types';
	import type { FormResult } from '$lib/types';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Field from '$lib/components/Field.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatDate, formatLongDate, plural } from '$lib/format';
	import { notify } from '$lib/toast.svelte';

	let { data, form }: { data: PageData; form: FormResult | null } = $props();
	let saving = $state<string | null>(null);
	const errorsFor = (intent: string) => (form?.intent === intent ? form.errors : undefined);
	const valuesFor = (intent: string) => (form?.intent === intent ? form.values : undefined);

	const submit = (intent: string) => () => {
		saving = intent;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			saving = null;
			// Keep typed values on failure; clear password fields after success.
			await update({ reset: (intent === 'password' || intent === 'createUser') && !form?.errors });
		};
	};

	$effect(() => {
		if (form?.message) notify(form.message);
		// Delete errors have no field to attach to; show them as a toast instead.
		if (form?.intent === 'deleteUser' && form.errors?.userId) notify(form.errors.userId, 'error');
	});
</script>

<svelte:head><title>Settings · Fitness Tracker</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader eyebrow="Account" title="Settings" />

	<form
		method="POST"
		action="?/profile"
		class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={submit('profile')}
	>
		<div>
			<h2 class="eyebrow text-ink-soft/70">Profile</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				Member since {formatLongDate(data.account.createdAt)}.
			</p>
		</div>
		<Field label="Name" name="name" error={errorsFor('profile')?.name}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="name"
					required
					maxlength="120"
					autocomplete="name"
					value={valuesFor('profile')?.name ?? data.account.name}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Button type="submit" loading={saving === 'profile'}>Save name</Button>
	</form>

	<form
		method="POST"
		action="?/email"
		class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={submit('email')}
	>
		<div>
			<h2 class="eyebrow text-ink-soft/70">Email</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				You sign in with this address. Confirm with your password to change it.
			</p>
		</div>
		<Field label="Email" name="email" error={errorsFor('email')?.email}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="email"
					inputmode="email"
					value={valuesFor('email')?.email ?? data.account.email}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="Current password" name="password" error={errorsFor('email')?.password}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="password"
					type="password"
					required
					autocomplete="current-password"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Button type="submit" loading={saving === 'email'}>Change email</Button>
	</form>

	<form
		method="POST"
		action="?/password"
		class="flex flex-col gap-4 rounded-3xl border border-ink-soft/12 bg-card p-5"
		use:enhance={submit('password')}
	>
		<div>
			<h2 class="eyebrow text-ink-soft/70">Password</h2>
			<p class="mt-2 text-sm text-ink-soft/80">
				At least 8 characters. Changing it signs out every other device; this one stays signed in.
			</p>
		</div>
		<Field
			label="Current password"
			name="currentPassword"
			error={errorsFor('password')?.currentPassword}
		>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="currentPassword"
					type="password"
					required
					autocomplete="current-password"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field label="New password" name="newPassword" error={errorsFor('password')?.newPassword}>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="newPassword"
					type="password"
					required
					minlength="8"
					maxlength="128"
					autocomplete="new-password"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Field
			label="Repeat new password"
			name="confirmPassword"
			error={errorsFor('password')?.confirmPassword}
		>
			{#snippet children({ id, describedBy, invalid })}
				<input
					{id}
					name="confirmPassword"
					type="password"
					required
					minlength="8"
					maxlength="128"
					autocomplete="new-password"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class={['field-input', invalid && 'field-input-error']}
				/>
			{/snippet}
		</Field>
		<Button type="submit" loading={saving === 'password'}>Change password</Button>
	</form>

	{#if data.isAdmin}
		<section class="flex flex-col gap-4 rounded-3xl border border-accent/30 bg-accent/5 p-5">
			<div>
				<h2 class="eyebrow text-accent">Administration · Accounts</h2>
				<p class="mt-2 text-sm text-ink-soft/80">
					Everyone who can sign in. Removing an account deletes its workouts, sets and machine
					setups for good; shared exercises and machines stay.
				</p>
			</div>

			<ul class="flex flex-col divide-y divide-ink-soft/10 rounded-2xl bg-card px-4">
				{#each data.users as u (u.id)}
					<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-semibold">{u.name}</span>
								{#if u.role === 'admin'}
									<span
										class="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] tracking-[.12em] text-accent uppercase"
										>Admin</span
									>
								{/if}
								{#if u.id === data.account.id}
									<span class="text-xs text-ink-soft/60">(you)</span>
								{/if}
							</div>
							<div class="truncate text-sm text-ink-soft/70">{u.email}</div>
							<div class="text-xs text-ink-soft/60">
								{plural(u.workoutCount, 'workout')} · joined {formatDate(u.createdAt)}
							</div>
						</div>
						{#if u.id !== data.account.id}
							<ConfirmAction
								action="?/deleteUser"
								label="Remove"
								size="sm"
								variant="ghost"
								confirmLabel="Delete account and data"
								question="Delete {u.name}, {plural(u.workoutCount, 'workout')} and all their sets?"
							>
								<input type="hidden" name="userId" value={u.id} />
							</ConfirmAction>
						{/if}
					</li>
				{/each}
			</ul>

			<form
				method="POST"
				action="?/createUser"
				class="flex flex-col gap-4 rounded-2xl bg-card p-4"
				use:enhance={submit('createUser')}
				autocomplete="off"
			>
				<h3 class="eyebrow text-ink-soft/70">New account</h3>
				<Field label="Name" name="name" error={errorsFor('createUser')?.name}>
					{#snippet children({ id, describedBy, invalid })}
						<input
							{id}
							name="name"
							required
							maxlength="120"
							autocomplete="off"
							value={valuesFor('createUser')?.name ?? ''}
							aria-describedby={describedBy}
							aria-invalid={invalid || undefined}
							class={['field-input', invalid && 'field-input-error']}
						/>
					{/snippet}
				</Field>
				<Field label="Email" name="email" error={errorsFor('createUser')?.email}>
					{#snippet children({ id, describedBy, invalid })}
						<input
							{id}
							name="email"
							type="email"
							required
							maxlength="254"
							inputmode="email"
							autocomplete="off"
							value={valuesFor('createUser')?.email ?? ''}
							aria-describedby={describedBy}
							aria-invalid={invalid || undefined}
							class={['field-input', invalid && 'field-input-error']}
						/>
					{/snippet}
				</Field>
				<Field
					label="Password"
					name="password"
					hint="At least 8 characters. They can change it after signing in."
					error={errorsFor('createUser')?.password}
				>
					{#snippet children({ id, describedBy, invalid })}
						<input
							{id}
							name="password"
							type="password"
							required
							minlength="8"
							maxlength="128"
							autocomplete="new-password"
							aria-describedby={describedBy}
							aria-invalid={invalid || undefined}
							class={['field-input', invalid && 'field-input-error']}
						/>
					{/snippet}
				</Field>
				<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
					<input
						type="checkbox"
						name="admin"
						value="on"
						checked={valuesFor('createUser')?.admin === 'on'}
						class="size-5 accent-accent"
					/>
					<span>Administrator (can manage accounts)</span>
				</label>
				<Button type="submit" variant="accent" loading={saving === 'createUser'}
					>Create account</Button
				>
			</form>
		</section>
	{/if}

	<p class="px-1 text-xs text-ink-soft/60">
		Forgot your password? The administrator can reset it from the server with
		<code class="font-mono">pnpm user:create --email … --reset-password</code>.
	</p>
</div>
