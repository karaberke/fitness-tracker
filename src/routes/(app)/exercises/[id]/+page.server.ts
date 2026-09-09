import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { getExercise, setExerciseArchived, updateExercise } from '$lib/server/exercises';
import { getMachineSetting, listMachines } from '$lib/server/machines';
import { failFrom, formValues, orNotFound } from '$lib/server/forms';
import { parseId } from '$lib/server/validate';
import type { Actions, PageServerLoad } from './$types';

const idOr404 = (param: string) => {
	const id = parseId(param);
	if (id == null) error(404, 'Exercise not found');
	return id;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	try {
		const [exercise, machines] = await Promise.all([
			getExercise(idOr404(event.params.id)),
			listMachines()
		]);
		const mySetup = exercise.machineId
			? await getMachineSetting(user.id, exercise.machineId)
			: null;
		return { exercise, machines, mySetup };
	} catch (e) {
		orNotFound(e);
	}
};

export const actions: Actions = {
	update: async (event) => {
		requireUser(event);
		const values = await formValues(event.request);
		try {
			await updateExercise(idOr404(event.params.id), values);
			return { message: 'Exercise saved' };
		} catch (e) {
			return failFrom(e, { values });
		}
	},
	archive: async (event) => {
		requireUser(event);
		try {
			await setExerciseArchived(idOr404(event.params.id), true);
		} catch (e) {
			return failFrom(e);
		}
		redirect(303, '/exercises');
	},
	restore: async (event) => {
		requireUser(event);
		try {
			await setExerciseArchived(idOr404(event.params.id), false);
			return { message: 'Exercise restored' };
		} catch (e) {
			return failFrom(e);
		}
	}
};
