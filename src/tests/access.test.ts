import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '$lib/server/errors';
import {
	createMachine,
	getMachineSetting,
	listMachineSettings,
	upsertMachineSetting
} from '$lib/server/machines';
import { createExercise } from '$lib/server/exercises';
import {
	addSet,
	addWorkoutExercise,
	deleteSet,
	deleteWorkout,
	finishWorkout,
	getWorkoutDetail,
	listWorkouts,
	removeWorkoutExercise,
	startWorkout,
	updateSet,
	updateWorkout,
	updateWorkoutExercise
} from '$lib/server/workouts';
import { closeDbAfterAll, createUser, resetDatabase } from './helpers';

closeDbAfterAll();

describe('cross-user access restrictions', () => {
	beforeEach(resetDatabase);

	it('hides another user’s workouts from every read and mutation', async () => {
		const alice = await createUser('Alice');
		const bob = await createUser('Bob');
		const exercise = await createExercise(alice.id, { name: 'Squat' });

		const { workout } = await startWorkout(alice.id);
		const block = await addWorkoutExercise(alice.id, workout.id, { exerciseId: exercise.id });
		const set = await addSet(alice.id, block.id, { reps: 5, weight: 100, unit: 'kg' });

		const notFound = NotFoundError;
		expect(await listWorkouts(bob.id)).toEqual([]);
		await expect(getWorkoutDetail(bob.id, workout.id)).rejects.toBeInstanceOf(notFound);
		await expect(updateWorkout(bob.id, workout.id, { title: 'x' })).rejects.toBeInstanceOf(
			notFound
		);
		await expect(finishWorkout(bob.id, workout.id)).rejects.toBeInstanceOf(notFound);
		await expect(deleteWorkout(bob.id, workout.id)).rejects.toBeInstanceOf(notFound);
		await expect(
			addWorkoutExercise(bob.id, workout.id, { exerciseId: exercise.id })
		).rejects.toBeInstanceOf(notFound);
		await expect(
			updateWorkoutExercise(bob.id, block.id, { machineConfiguration: 'x' })
		).rejects.toBeInstanceOf(notFound);
		await expect(removeWorkoutExercise(bob.id, block.id)).rejects.toBeInstanceOf(notFound);
		await expect(addSet(bob.id, block.id, { reps: 1, weight: 1 })).rejects.toBeInstanceOf(notFound);
		await expect(updateSet(bob.id, set.id, { reps: 1, weight: 1 })).rejects.toBeInstanceOf(
			notFound
		);
		await expect(deleteSet(bob.id, set.id)).rejects.toBeInstanceOf(notFound);

		// Nothing changed for Alice.
		const detail = await getWorkoutDetail(alice.id, workout.id);
		expect(detail.title).toBeNull();
		expect(detail.exercises).toHaveLength(1);
		expect(detail.exercises[0].sets).toHaveLength(1);
	});

	it('keeps personal machine defaults private while sharing the machine itself', async () => {
		const alice = await createUser('Alice');
		const bob = await createUser('Bob');
		const machine = await createMachine(alice.id, { name: 'Chest Press', gym: 'Downtown' });

		await upsertMachineSetting(alice.id, machine.id, { configuration: 'Seat 4' });
		await upsertMachineSetting(bob.id, machine.id, { configuration: 'Seat 7' });

		expect((await getMachineSetting(alice.id, machine.id))?.configuration).toBe('Seat 4');
		expect((await getMachineSetting(bob.id, machine.id))?.configuration).toBe('Seat 7');
		const aliceDefaults = [...(await listMachineSettings(alice.id)).values()];
		expect(aliceDefaults.map((s) => s.configuration)).toEqual(['Seat 4']);

		// Each user's new workout picks up their own default.
		const { workout: aw } = await startWorkout(alice.id);
		const { workout: bw } = await startWorkout(bob.id);
		const exercise = await createExercise(alice.id, { name: 'Bench' });
		const ab = await addWorkoutExercise(alice.id, aw.id, {
			exerciseId: exercise.id,
			machineId: machine.id
		});
		const bb = await addWorkoutExercise(bob.id, bw.id, {
			exerciseId: exercise.id,
			machineId: machine.id
		});
		expect(ab.machineConfiguration).toBe('Seat 4');
		expect(bb.machineConfiguration).toBe('Seat 7');
	});
});
