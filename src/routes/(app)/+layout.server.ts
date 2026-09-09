import { requireUser } from '$lib/server/auth/guard';
import { getActiveWorkout } from '$lib/server/workouts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const active = await getActiveWorkout(user.id);
	return { activeWorkoutId: active?.id ?? null };
};
