import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { formValues, safeNext } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), '/dashboard'));
	return { next: safeNext(url.searchParams.get('next'), '/dashboard') };
};

export const actions: Actions = {
	default: async (event) => {
		const values = await formValues(event.request);
		const email = values.email?.trim().toLowerCase() ?? '';
		const password = values.password ?? '';
		const next = safeNext(values.next, '/dashboard');

		const errors: Record<string, string> = {};
		if (!email) errors.email = 'Enter your email';
		if (!password) errors.password = 'Enter your password';
		if (Object.keys(errors).length) return fail(400, { email, errors });

		try {
			// The sveltekitCookies plugin copies the session cookie onto this response.
			await auth.api.signInEmail({ body: { email, password }, headers: event.request.headers });
		} catch (e) {
			if (e instanceof APIError) {
				return fail(401, { email, errors: { form: 'Email or password is incorrect' } });
			}
			throw e;
		}
		redirect(303, next);
	}
};
