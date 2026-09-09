import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { listWorkouts, startWorkout } from '$lib/server/workouts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	return { workouts: await listWorkouts(user.id) };
};

export const actions: Actions = {
	start: async (event) => {
		const user = requireUser(event);
		const { workout } = await startWorkout(user.id);
		redirect(303, `/workouts/${workout.id}`);
	}
};
