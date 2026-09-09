import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise, setExerciseArchived, updateExercise } from '$lib/server/exercises';
import { createMachine, setMachineArchived, upsertMachineSetting } from '$lib/server/machines';
import { ValidationError } from '$lib/server/errors';
import {
	addSet,
	addWorkoutExercise,
	deleteSet,
	deleteWorkout,
	finishWorkout,
	getActiveWorkout,
	getWorkoutDetail,
	listWorkouts,
	reopenWorkout,
	startWorkout,
	updateSet,
	updateWorkout,
	updateWorkoutExercise
} from '$lib/server/workouts';
import { closeDbAfterAll, createUser, resetDatabase } from './helpers';

closeDbAfterAll();

describe('workout persistence', () => {
	beforeEach(resetDatabase);

	it('saves every logged entry so a fresh read returns it', async () => {
		const user = await createUser();
		const squat = await createExercise(user.id, { name: 'Squat', category: 'Legs' });
		const pullUp = await createExercise(user.id, { name: 'Pull-up', isBodyweight: true });

		const { workout, resumed } = await startWorkout(user.id, { title: 'Leg day' });
		expect(resumed).toBe(false);

		// Starting again resumes the in-progress workout instead of creating a second one.
		const again = await startWorkout(user.id);
		expect(again.resumed).toBe(true);
		expect(again.workout.id).toBe(workout.id);
		expect((await getActiveWorkout(user.id))?.id).toBe(workout.id);

		const b1 = await addWorkoutExercise(user.id, workout.id, { exerciseId: squat.id });
		await addSet(user.id, b1.id, { reps: '5', weight: '100', unit: 'kg' });
		await addSet(user.id, b1.id, { reps: 5, weight: 102.5, unit: 'kg' });
		const b2 = await addWorkoutExercise(user.id, workout.id, { exerciseId: pullUp.id });
		const bw = await addSet(user.id, b2.id, { reps: 8, weight: '', unit: 'kg' });
		expect(bw.weight).toBe(0);
		await updateWorkout(user.id, workout.id, { title: 'Leg day', notes: 'Felt strong' });

		// Simulates a page refresh: everything comes back from the database.
		const detail = await getWorkoutDetail(user.id, workout.id);
		expect(detail.notes).toBe('Felt strong');
		expect(detail.exercises.map((e) => e.exercise.name)).toEqual(['Squat', 'Pull-up']);
		expect(detail.exercises[0].sets.map((s) => [s.position, s.reps, s.weight, s.unit])).toEqual([
			[1, 5, 100, 'kg'],
			[2, 5, 102.5, 'kg']
		]);
		expect(detail.exercises[1].sets[0].weight).toBe(0);

		// Edit and remove sets.
		const second = detail.exercises[0].sets[1];
		const edited = await updateSet(user.id, second.id, { reps: 4, weight: 105, unit: 'lb' });
		expect([edited.reps, edited.weight, edited.unit]).toEqual([4, 105, 'lb']);
		await deleteSet(user.id, detail.exercises[0].sets[0].id);
		const afterEdit = await getWorkoutDetail(user.id, workout.id);
		expect(afterEdit.exercises[0].sets.map((s) => s.id)).toEqual([second.id]);

		// Finish, then it shows up in history with summary counts.
		const finished = await finishWorkout(user.id, workout.id);
		expect(finished.finishedAt).toBeInstanceOf(Date);
		expect(await getActiveWorkout(user.id)).toBeNull();
		const history = await listWorkouts(user.id);
		expect(history).toHaveLength(1);
		expect(history[0].exerciseCount).toBe(2);
		expect(history[0].setCount).toBe(2);
		expect(history[0].exerciseNames).toEqual(['Squat', 'Pull-up']);

		// Re-open, log another set, and start a new workout only after finishing.
		await reopenWorkout(user.id, workout.id);
		await addSet(user.id, b2.id, { reps: 6, weight: 0 });
		await finishWorkout(user.id, workout.id);
		const next = await startWorkout(user.id);
		expect(next.resumed).toBe(false);
		await expect(reopenWorkout(user.id, workout.id)).rejects.toBeInstanceOf(ValidationError);

		// Delete cascades to blocks and sets.
		await deleteWorkout(user.id, workout.id);
		expect((await listWorkouts(user.id)).map((w) => w.id)).toEqual([next.workout.id]);
	});
});

describe('historical machine configuration', () => {
	beforeEach(resetDatabase);

	it('snapshots the configuration per set and ignores later changes to defaults', async () => {
		const user = await createUser();
		const bench = await createExercise(user.id, { name: 'Bench Press' });
		const press = await createMachine(user.id, {
			name: 'Chest Press',
			gym: 'Downtown',
			model: 'TG 700'
		});
		await upsertMachineSetting(user.id, press.id, { configuration: 'Seat 4 · Handles 2' });

		const { workout } = await startWorkout(user.id);
		const block = await addWorkoutExercise(user.id, workout.id, {
			exerciseId: bench.id,
			machineId: press.id
		});
		expect(block.machineConfiguration).toBe('Seat 4 · Handles 2');

		const s1 = await addSet(user.id, block.id, { reps: 10, weight: 40 });
		expect(s1.machineConfiguration).toBe('Seat 4 · Handles 2');

		// Configuration change between sets: the next set carries the new value, the first keeps the old.
		const s2 = await addSet(user.id, block.id, {
			reps: 8,
			weight: 50,
			machineConfiguration: 'Seat 5 · Handles 2'
		});
		expect(s2.machineConfiguration).toBe('Seat 5 · Handles 2');
		const s3 = await addSet(user.id, block.id, { reps: 8, weight: 50 });
		expect(s3.machineConfiguration).toBe('Seat 5 · Handles 2');

		// Changing the personal default afterwards, or the block config, does not rewrite history.
		await upsertMachineSetting(user.id, press.id, { configuration: 'Seat 6' });
		await updateWorkoutExercise(user.id, block.id, {
			machineId: press.id,
			machineConfiguration: 'Seat 7'
		});
		const s4 = await addSet(user.id, block.id, { reps: 6, weight: 55 });
		expect(s4.machineConfiguration).toBe('Seat 7');

		const detail = await getWorkoutDetail(user.id, workout.id);
		expect(detail.exercises[0].sets.map((s) => s.machineConfiguration)).toEqual([
			'Seat 4 · Handles 2',
			'Seat 5 · Handles 2',
			'Seat 5 · Handles 2',
			'Seat 7'
		]);

		// Editing or archiving catalog entries keeps the history intact.
		await updateExercise(bench.id, { name: 'Barbell Bench Press' });
		await setExerciseArchived(bench.id, true);
		await setMachineArchived(press.id, true);
		const after = await getWorkoutDetail(user.id, workout.id);
		expect(after.exercises[0].exercise.name).toBe('Barbell Bench Press');
		expect(after.exercises[0].exercise.archivedAt).toBeInstanceOf(Date);
		expect(after.exercises[0].machine?.name).toBe('Chest Press');
		expect(after.exercises[0].sets).toHaveLength(4);
	});
});
