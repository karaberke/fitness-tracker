import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/auth/guard';
import { listExercises } from '$lib/server/exercises';
import { listMachines } from '$lib/server/machines';
import { getActiveWorkout, listWorkouts, startWorkout, workoutStats } from '$lib/server/workouts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [active, workouts, stats, exercises, machines] = await Promise.all([
		getActiveWorkout(user.id),
		listWorkouts(user.id),
		workoutStats(user.id),
		listExercises(),
		listMachines()
	]);
	return {
		active,
		recent: workouts.filter((w) => w.finishedAt).slice(0, 5),
		stats,
		exerciseCount: exercises.length,
		machineCount: machines.length
	};
};

export const actions: Actions = {
	start: async (event) => {
		const user = requireUser(event);
		const { workout } = await startWorkout(user.id);
		redirect(303, `/workouts/${workout.id}`);
	},
	logout: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(303, '/login');
	}
};
