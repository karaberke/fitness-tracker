import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { listExercises } from '$lib/server/exercises';
import { failFrom, formValues, orNotFound } from '$lib/server/forms';
import { listMachineSettings, listMachines } from '$lib/server/machines';
import { parseId } from '$lib/server/validate';
import {
	addSet,
	addWorkoutExercise,
	deleteSet,
	deleteWorkout,
	finishWorkout,
	getWorkoutDetail,
	lastSetsForExercise,
	removeWorkoutExercise,
	reopenWorkout,
	updateSet,
	updateWorkout,
	updateWorkoutExercise
} from '$lib/server/workouts';
import type { Actions, PageServerLoad } from './$types';

const idOr404 = (param: string) => {
	const id = parseId(param);
	if (id == null) error(404, 'Workout not found');
	return id;
};

const idOrFail = (v: string | undefined) => {
	const id = parseId(v);
	if (id == null) error(400, 'Missing id');
	return id;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const id = idOr404(event.params.id);
	try {
		const [workout, exercises, machines, settings] = await Promise.all([
			getWorkoutDetail(user.id, id),
			listExercises(),
			listMachines(),
			listMachineSettings(user.id)
		]);
		// For blocks without sets yet, show what was logged last time as a starting point.
		const previous: Record<number, { reps: number; weight: number; unit: string }[]> = {};
		await Promise.all(
			workout.exercises
				.filter((b) => b.sets.length === 0)
				.map(async (b) => {
					const last = await lastSetsForExercise(user.id, b.exerciseId, id);
					if (last.length)
						previous[b.id] = last.map(({ reps, weight, unit }) => ({ reps, weight, unit }));
				})
		);
		return {
			workout,
			exercises,
			machines,
			myDefaults: Object.fromEntries([...settings].map(([k, v]) => [k, v.configuration])),
			previous
		};
	} catch (e) {
		orNotFound(e);
	}
};

export const actions: Actions = {
	addExercise: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			const block = await addWorkoutExercise(user.id, idOr404(event.params.id), values);
			return { intent: 'addExercise', id: block.id, message: 'Exercise added' };
		} catch (e) {
			return failFrom(e, { intent: 'addExercise', values });
		}
	},
	updateBlock: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		const blockId = idOrFail(values.workoutExerciseId);
		try {
			await updateWorkoutExercise(user.id, blockId, values);
			return { intent: 'updateBlock', id: blockId, message: 'Setup updated for the next sets' };
		} catch (e) {
			return failFrom(e, { intent: 'updateBlock', id: blockId, values });
		}
	},
	removeBlock: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			await removeWorkoutExercise(user.id, idOrFail(values.workoutExerciseId));
			return { intent: 'removeBlock', message: 'Exercise removed' };
		} catch (e) {
			return failFrom(e);
		}
	},
	addSet: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		const blockId = idOrFail(values.workoutExerciseId);
		try {
			const set = await addSet(user.id, blockId, values);
			return { intent: 'addSet', id: blockId, message: `Set ${set.position} saved` };
		} catch (e) {
			return failFrom(e, { intent: 'addSet', id: blockId, values });
		}
	},
	updateSet: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		const setId = idOrFail(values.setId);
		try {
			await updateSet(user.id, setId, values);
			return { intent: 'updateSet', id: setId, message: 'Set updated' };
		} catch (e) {
			return failFrom(e, { intent: 'updateSet', id: setId, values });
		}
	},
	deleteSet: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			await deleteSet(user.id, idOrFail(values.setId));
			return { intent: 'deleteSet', message: 'Set removed' };
		} catch (e) {
			return failFrom(e);
		}
	},
	saveDetails: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			await updateWorkout(user.id, idOr404(event.params.id), values);
			return { intent: 'saveDetails', message: 'Notes saved' };
		} catch (e) {
			return failFrom(e, { intent: 'saveDetails', values });
		}
	},
	finish: async (event) => {
		const user = requireUser(event);
		try {
			await finishWorkout(user.id, idOr404(event.params.id));
			return { intent: 'finish', message: 'Workout finished' };
		} catch (e) {
			return failFrom(e);
		}
	},
	reopen: async (event) => {
		const user = requireUser(event);
		try {
			await reopenWorkout(user.id, idOr404(event.params.id));
			return { intent: 'reopen', message: 'Workout reopened' };
		} catch (e) {
			return failFrom(e, { intent: 'reopen' });
		}
	},
	delete: async (event) => {
		const user = requireUser(event);
		try {
			await deleteWorkout(user.id, idOr404(event.params.id));
		} catch (e) {
			return failFrom(e);
		}
		redirect(303, '/workouts');
	}
};
