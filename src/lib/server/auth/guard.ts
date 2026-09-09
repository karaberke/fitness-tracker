import { error, redirect, type RequestEvent } from '@sveltejs/kit';

/**
 * Returns the signed-in user or redirects to the login page. Every load
 * function and form action that touches private data must call this and
 * pass the returned id to the feature modules — never trust a user id
 * coming from the client.
 */
export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		const next = event.url.pathname + event.url.search;
		redirect(303, next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login');
	}
	return user;
}

/** Like `requireUser`, but responds 403 unless the account has the admin role. */
export function requireAdmin(event: RequestEvent) {
	const user = requireUser(event);
	if (user.role !== 'admin') error(403, 'Administrator access required');
	return user;
}
