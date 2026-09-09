import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { createExercise, listExercisesWithMachine } from '$lib/server/exercises';
import { listMachines } from '$lib/server/machines';
import { failFrom, formValues } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireUser(event);
	const [all, machines] = await Promise.all([
		listExercisesWithMachine({ includeArchived: true }),
		listMachines()
	]);
	return {
		exercises: all.filter((e) => !e.archivedAt),
		archived: all.filter((e) => e.archivedAt),
		machines
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			const exercise = await createExercise(user.id, values);
			redirect(303, `/exercises?created=${exercise.id}`);
		} catch (e) {
			return failFrom(e, { values });
		}
	}
};
