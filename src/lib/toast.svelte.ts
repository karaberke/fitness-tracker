export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

let nextId = 1;

/** Tiny global store for transient save feedback. */
export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function notify(message: string, kind: ToastKind = 'success', ttl = 2600) {
	const id = nextId++;
	toasts.list.push({ id, message, kind });
	setTimeout(() => dismiss(id), ttl);
	return id;
}

export function dismiss(id: number) {
	const i = toasts.list.findIndex((t) => t.id === id);
	if (i !== -1) toasts.list.splice(i, 1);
}
