/** Formatting helpers shared by server-rendered and client code. */

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});
const longDateFmt = new Intl.DateTimeFormat('en-GB', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export const formatDate = (d: Date | string) => dateFmt.format(toDate(d));
export const formatLongDate = (d: Date | string) => longDateFmt.format(toDate(d));
export const formatTime = (d: Date | string) => timeFmt.format(toDate(d));
/** "2026-09-08" in the local time zone — used to group history by day. */
export const dayKey = (d: Date | string) => dayKeyFmt.format(toDate(d));

export function relativeDay(d: Date | string): string {
	const key = dayKey(d);
	const today = dayKey(new Date());
	if (key === today) return 'Today';
	const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
	if (key === yesterday) return 'Yesterday';
	return formatDate(d);
}

export function formatDuration(start: Date | string, end: Date | string | null): string {
	const ms = (end ? toDate(end).getTime() : Date.now()) - toDate(start).getTime();
	const mins = Math.max(0, Math.round(ms / 60000));
	if (mins < 60) return `${mins} min`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

export const formatWeight = (n: number) =>
	Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 × 50 kg" or "12 reps" for bodyweight sets. */
export function describeSet(s: { reps: number; weight: number; unit: string }): string {
	return s.weight > 0 ? `${s.reps} × ${formatWeight(s.weight)} ${s.unit}` : `${s.reps} reps`;
}

/** Stable insertion-ordered grouping, e.g. exercises by category. */
export function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
	const out: Record<string, T[]> = {};
	for (const item of items) (out[key(item)] ??= []).push(item);
	return Object.entries(out);
}
