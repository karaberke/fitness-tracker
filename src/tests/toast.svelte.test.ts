import { flushSync } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { announce, dismiss, notify, toasts } from '$lib/toast.svelte';

/**
 * Pages show save feedback from inside `$effect(() => { ... notify(form.message) })`.
 * Effects re-run whenever something they read changes, so the toast helpers must
 * neither register the toast list as a dependency nor repeat a message for the
 * same form result. Regression test for duplicated "Account created" toasts.
 */
describe('toasts from effects', () => {
	beforeEach(() => {
		toasts.list.length = 0;
	});

	it('notify() inside an effect does not re-run the effect when the list changes', () => {
		const form = $state<{ message?: string }>({ message: 'Saved' });
		const stop = $effect.root(() => {
			$effect(() => {
				if (form.message) notify(form.message);
			});
		});
		flushSync();
		expect(toasts.list.map((t) => t.message)).toEqual(['Saved']);

		// Dismissing (what the timeout does) must not trigger another toast.
		dismiss(toasts.list[0].id);
		flushSync();
		expect(toasts.list).toHaveLength(0);
		stop();
	});

	it('announce() shows one toast per form result even when the effect re-runs', () => {
		let form = $state<{ message?: string } | null>({ message: 'Account created' });
		let unrelated = $state(0);
		const stop = $effect.root(() => {
			$effect(() => {
				void unrelated; // e.g. page data reloaded after the action
				announce(form, form?.message);
			});
		});
		flushSync();
		expect(toasts.list).toHaveLength(1);

		unrelated += 1;
		flushSync();
		expect(toasts.list).toHaveLength(1);

		// A new result (second submission) is a new toast.
		form = { message: 'Account created' };
		flushSync();
		expect(toasts.list).toHaveLength(2);

		form = null;
		flushSync();
		expect(toasts.list).toHaveLength(2);
		stop();
	});
});
