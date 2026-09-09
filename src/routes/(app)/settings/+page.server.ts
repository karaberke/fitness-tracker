import { changeEmail, changePassword, updateProfile } from '$lib/server/account';
import { createUser, deleteUser, listUsers } from '$lib/server/admin';
import { auth, provisioning } from '$lib/server/auth';
import { requireAdmin, requireUser } from '$lib/server/auth/guard';
import { failFrom, formValues } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const isAdmin = user.role === 'admin';
	return {
		account: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
		isAdmin,
		users: isAdmin ? await listUsers() : []
	};
};

// `event.request.headers` carries the session cookie, so Better Auth resolves the
// account from the session — never from anything the form sends.
export const actions: Actions = {
	profile: async (event) => {
		requireUser(event);
		const values = await formValues(event.request);
		try {
			await updateProfile(auth, event.request.headers, values);
			return { intent: 'profile', message: 'Name saved' };
		} catch (e) {
			return failFrom(e, { intent: 'profile', values });
		}
	},
	email: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			await changeEmail(auth, user.id, event.request.headers, values);
			return { intent: 'email', message: 'Email updated' };
		} catch (e) {
			// Never echo the password back to the page.
			return failFrom(e, { intent: 'email', values: { email: values.email ?? '' } });
		}
	},
	password: async (event) => {
		requireUser(event);
		const values = await formValues(event.request);
		try {
			await changePassword(auth, event.request.headers, values);
			return { intent: 'password', message: 'Password changed. Other devices were signed out.' };
		} catch (e) {
			return failFrom(e, { intent: 'password' });
		}
	},
	createUser: async (event) => {
		requireAdmin(event);
		const values = await formValues(event.request);
		try {
			const created = await createUser(provisioning, values);
			return { intent: 'createUser', message: `Account created for ${created.email}` };
		} catch (e) {
			const { name = '', email = '', admin = '' } = values;
			return failFrom(e, { intent: 'createUser', values: { name, email, admin } });
		}
	},
	deleteUser: async (event) => {
		const admin = requireAdmin(event);
		const values = await formValues(event.request);
		try {
			const removed = await deleteUser(admin.id, values.userId ?? '');
			return { intent: 'deleteUser', message: `Removed ${removed.email} and their data` };
		} catch (e) {
			return failFrom(e, { intent: 'deleteUser' });
		}
	}
};
