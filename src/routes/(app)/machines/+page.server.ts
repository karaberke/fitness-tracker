import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { failFrom, formValues } from '$lib/server/forms';
import { createMachine, listMachineSettings, listMachines } from '$lib/server/machines';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [all, settings] = await Promise.all([
		listMachines({ includeArchived: true }),
		listMachineSettings(user.id)
	]);
	const withDefaults = all.map((m) => ({
		...m,
		myDefault: settings.get(m.id)?.configuration ?? null
	}));
	return {
		machines: withDefaults.filter((m) => !m.archivedAt),
		archived: withDefaults.filter((m) => m.archivedAt)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			const machine = await createMachine(user.id, values);
			redirect(303, `/machines/${machine.id}`);
		} catch (e) {
			return failFrom(e, { values });
		}
	}
};
