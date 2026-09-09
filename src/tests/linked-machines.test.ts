import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '$lib/server/errors';
import {
	createExercise,
	getExercise,
	listExercisesForMachine,
	updateExercise
} from '$lib/server/exercises';
import { createMachine, setMachineArchived, upsertMachineSetting } from '$lib/server/machines';
import { addWorkoutExercise, startWorkout } from '$lib/server/workouts';
import { closeDbAfterAll, createUser, resetDatabase } from './helpers';

closeDbAfterAll();

describe('exercises linked to machines', () => {
	beforeEach(resetDatabase);

	it('requires a machine when "uses a machine" is checked and exposes the link', async () => {
		const user = await createUser();
		const press = await createMachine(user.id, { name: 'Chest Press', gym: 'Downtown' });
		await expect(
			createExercise(user.id, { name: 'Bench', usesMachine: 'on' })
		).rejects.toBeInstanceOf(ValidationError);
		await expect(
			createExercise(user.id, { name: 'Bench', usesMachine: 'on', machineId: 999 })
		).rejects.toBeInstanceOf(ValidationError);

		const bench = await createExercise(user.id, {
			name: 'Bench',
			usesMachine: 'on',
			machineId: press.id
		});
		expect(bench.usesMachine).toBe(true);
		expect(bench.machineId).toBe(press.id);
		expect((await getExercise(bench.id)).machine?.name).toBe('Chest Press');
		expect((await listExercisesForMachine(press.id)).map((e) => e.name)).toEqual(['Bench']);

		// Unchecking clears the link even if a machine id is still submitted.
		const updated = await updateExercise(bench.id, { name: 'Bench', machineId: press.id });
		expect(updated.usesMachine).toBe(false);
		expect(updated.machineId).toBeNull();
	});

	it('pre-selects the linked machine and the user’s setup when added to a workout', async () => {
		const user = await createUser();
		const other = await createUser('Other');
		const press = await createMachine(user.id, { name: 'Chest Press' });
		const bench = await createExercise(user.id, {
			name: 'Bench',
			usesMachine: true,
			machineId: press.id
		});
		await upsertMachineSetting(user.id, press.id, { configuration: 'Seat 4' });

		const { workout } = await startWorkout(user.id);
		const block = await addWorkoutExercise(user.id, workout.id, {
			exerciseId: bench.id,
			machineId: ''
		});
		expect(block.machineId).toBe(press.id);
		expect(block.machineConfiguration).toBe('Seat 4');

		// Another user gets the same machine but no configuration of their own.
		const { workout: ow } = await startWorkout(other.id);
		const otherBlock = await addWorkoutExercise(other.id, ow.id, { exerciseId: bench.id });
		expect(otherBlock.machineId).toBe(press.id);
		expect(otherBlock.machineConfiguration).toBeNull();

		// An explicit choice wins over the link; an archived linked machine is not pre-selected.
		const rack = await createMachine(user.id, { name: 'Rack' });
		const explicit = await addWorkoutExercise(user.id, workout.id, {
			exerciseId: bench.id,
			machineId: rack.id
		});
		expect(explicit.machineId).toBe(rack.id);
		await setMachineArchived(press.id, true);
		const afterArchive = await addWorkoutExercise(user.id, workout.id, { exerciseId: bench.id });
		expect(afterArchive.machineId).toBeNull();
	});
});
