import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The root URL belongs to the authenticated app; unauthenticated visitors go to login.
export const load: PageServerLoad = ({ locals }) => {
	redirect(303, locals.user ? '/dashboard' : '/login');
};
