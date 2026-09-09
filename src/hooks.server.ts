import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (!building) {
		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.user = result?.user ?? null;
		event.locals.session = result?.session ?? null;
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}
	return svelteKitHandler({ event, resolve, auth, building });
};
