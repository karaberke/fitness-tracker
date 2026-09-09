import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '$lib/server/errors';
import { createExercise } from '$lib/server/exercises';
import { createMachine, upsertMachineSetting } from '$lib/server/machines';
import { addSet, addWorkoutExercise, parseSet, startWorkout } from '$lib/server/workouts';
import { closeDbAfterAll, createUser, resetDatabase } from './helpers';

closeDbAfterAll();

const fields = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		if (e instanceof ValidationError) return e.fields;
		throw e;
	}
	return {};
};

describe('set validation', () => {
	it('requires at least one rep and a valid unit', () => {
		const weighted = { isBodyweight: false };
		expect(fields(() => parseSet({ reps: 0, weight: 50 }, weighted))).toHaveProperty('reps');
		expect(fields(() => parseSet({ reps: '2.5', weight: 50 }, weighted))).toHaveProperty('reps');
		expect(fields(() => parseSet({ reps: '', weight: 50 }, weighted))).toHaveProperty('reps');
		expect(fields(() => parseSet({ reps: 5, weight: 50, unit: 'st' }, weighted))).toHaveProperty(
			'unit'
		);
		expect(fields(() => parseSet({ reps: 5, weight: -1 }, weighted))).toHaveProperty('weight');
		expect(fields(() => parseSet({ reps: 5, weight: 'abc' }, weighted))).toHaveProperty('weight');
	});

	it('requires a positive weight for weighted exercises but not for bodyweight ones', () => {
		const weighted = { isBodyweight: false };
		const bodyweight = { isBodyweight: true };
		expect(fields(() => parseSet({ reps: 5, weight: 0 }, weighted))).toHaveProperty('weight');
		expect(fields(() => parseSet({ reps: 5, weight: '' }, weighted))).toHaveProperty('weight');
		expect(parseSet({ reps: 5, weight: '' }, bodyweight)).toMatchObject({
			reps: 5,
			weight: 0,
			unit: 'kg'
		});
		expect(parseSet({ reps: 5, weight: 0 }, bodyweight).weight).toBe(0);
		expect(parseSet({ reps: 5, weight: '2,5', unit: 'lb' }, bodyweight)).toMatchObject({
			weight: 2.5,
			unit: 'lb'
		});
	});
});

describe('catalog and workout validation against the database', () => {
	beforeEach(resetDatabase);

	it('rejects blank and duplicate names', async () => {
		const user = await createUser();
		await expect(createExercise(user.id, { name: '   ' })).rejects.toBeInstanceOf(ValidationError);
		await createExercise(user.id, { name: 'Row' });
		await expect(createExercise(user.id, { name: 'row' })).rejects.toBeInstanceOf(ValidationError);
		await createMachine(user.id, { name: 'Cable Row', gym: 'Downtown' });
		await expect(
			createMachine(user.id, { name: 'cable row', gym: 'downtown' })
		).rejects.toBeInstanceOf(ValidationError);
		// Same name at a different gym is fine.
		await expect(
			createMachine(user.id, { name: 'Cable Row', gym: 'Uptown' })
		).resolves.toBeTruthy();
		await expect(createMachine(user.id, { name: '' })).rejects.toBeInstanceOf(ValidationError);
	});

	it('rejects unknown exercises and machines, empty defaults, and invalid sets', async () => {
		const user = await createUser();
		const { workout } = await startWorkout(user.id);
		await expect(
			addWorkoutExercise(user.id, workout.id, { exerciseId: 999 })
		).rejects.toBeInstanceOf(ValidationError);
		await expect(addWorkoutExercise(user.id, workout.id, {})).rejects.toBeInstanceOf(
			ValidationError
		);
		const ex = await createExercise(user.id, { name: 'Curl' });
		await expect(
			addWorkoutExercise(user.id, workout.id, { exerciseId: ex.id, machineId: 999 })
		).rejects.toBeInstanceOf(ValidationError);
		const block = await addWorkoutExercise(user.id, workout.id, { exerciseId: ex.id });
		await expect(addSet(user.id, block.id, { reps: 0, weight: 10 })).rejects.toBeInstanceOf(
			ValidationError
		);
		await expect(addSet(user.id, block.id, { reps: 10, weight: 0 })).rejects.toBeInstanceOf(
			ValidationError
		);
		const machine = await createMachine(user.id, { name: 'Preacher Curl' });
		await expect(
			upsertMachineSetting(user.id, machine.id, { configuration: '' })
		).rejects.toBeInstanceOf(ValidationError);
		await expect(upsertMachineSetting(user.id, 999, { configuration: 'Seat 1' })).rejects.toThrow();
	});
});
