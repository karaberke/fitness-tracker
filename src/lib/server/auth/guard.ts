import { error, redirect, type RequestEvent } from '@sveltejs/kit';

/** A load event (has `untrack`) or a form-action / hook event (does not). */
type GuardEvent = RequestEvent & { untrack?: <T>(fn: () => T) => T };
const read = <T>(event: GuardEvent, fn: () => T): T => (event.untrack ? event.untrack(fn) : fn());

/**
 * Returns the signed-in user or redirects to the login page. Every load
 * function and form action that touches private data must call this and
 * pass the returned id to the feature modules — never trust a user id
 * coming from the client.
 */
export function requireUser(event: GuardEvent) {
	const user = event.locals.user;
	if (!user) {
		// Read the URL without tracking it: otherwise every load that calls this
		// (the app layout included) would re-run on every navigation.
		const next = read(event, () => event.url.pathname + event.url.search);
		redirect(303, next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login');
	}
	return user;
}

/** Like `requireUser`, but responds 403 unless the account has the admin role. */
export function requireAdmin(event: GuardEvent) {
	const user = requireUser(event);
	if (user.role !== 'admin') error(403, 'Administrator access required');
	return user;
}
