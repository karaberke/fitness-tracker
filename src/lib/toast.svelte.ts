import { untrack } from 'svelte';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

let nextId = 1;

/** Tiny global store for transient save feedback. */
export const toasts = $state<{ list: Toast[] }>({ list: [] });

/**
 * Shows a toast. Safe to call from inside `$effect`: the list is touched inside
 * `untrack`, so the effect does not become dependent on it (otherwise every
 * push or dismiss would re-run the effect and repeat the toast).
 */
export function notify(message: string, kind: ToastKind = 'success', ttl = 2600) {
	const id = nextId++;
	untrack(() => toasts.list.push({ id, message, kind }));
	setTimeout(() => dismiss(id), ttl);
	return id;
}

export function dismiss(id: number) {
	untrack(() => {
		const i = toasts.list.findIndex((t) => t.id === id);
		if (i !== -1) toasts.list.splice(i, 1);
	});
}

const announced = new WeakSet<object>();

/**
 * Shows `message` once for a given form result. Pages call this from an effect
 * that also re-runs when page data reloads; the result object is remembered so
 * a re-run never repeats the toast, while a new submission (new object) does.
 */
export function announce(
	result: object | null | undefined,
	message: string | null | undefined,
	kind: ToastKind = 'success',
	ttl?: number
) {
	if (!result || !message || announced.has(result)) return;
	announced.add(result);
	notify(message, kind, ttl);
}
