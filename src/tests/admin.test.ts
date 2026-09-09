import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser, deleteUser, listUsers } from '$lib/server/admin';
import { createAuth } from '$lib/server/auth/create';
import { db } from '$lib/server/db';
import { machines, machineSettings, sets, users, workouts } from '$lib/server/db/schema';
import { NotFoundError, ValidationError } from '$lib/server/errors';
import { createMachine, upsertMachineSetting } from '$lib/server/machines';
import { addSet, addWorkoutExercise, startWorkout } from '$lib/server/workouts';
import { createExercise } from '$lib/server/exercises';
import { closeDbAfterAll, createUser as insertUser, resetDatabase } from './helpers';

closeDbAfterAll();

const secret = 'test-secret-not-for-production';
const baseURL = 'http://localhost:5173';
const app = createAuth({ db, secret, baseURL });
const provisioning = createAuth({ db, secret, baseURL, allowSignUp: true });

describe('administration', () => {
	beforeEach(resetDatabase);

	it('creates accounts that can sign in, with the requested role', async () => {
		const plain = await createUser(provisioning, {
			name: ' Pat ',
			email: 'Pat@Example.com',
			password: 'pat-password'
		});
		expect(plain).toMatchObject({ name: 'Pat', email: 'pat@example.com', role: 'user' });

		const boss = await createUser(provisioning, {
			name: 'Boss',
			email: 'boss@example.com',
			password: 'boss-password',
			admin: 'on'
		});
		expect(boss.role).toBe('admin');

		// The role reaches the session so the guard can read it.
		const res = await app.api.signInEmail({
			body: { email: 'boss@example.com', password: 'boss-password' },
			asResponse: true
		});
		const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
		const session = await app.api.getSession({ headers: new Headers({ cookie }) });
		expect(session?.user.role).toBe('admin');

		// Creating an account never signs anyone in.
		expect(await db.select().from(users)).toHaveLength(2);
		const { sessions } = await import('$lib/server/db/schema');
		const rows = await db.select().from(sessions);
		expect(rows.every((s) => s.userId === boss.id)).toBe(true);
	});

	it('validates new accounts and rejects duplicate emails', async () => {
		await expect(
			createUser(provisioning, { name: '', email: 'bad', password: 'short' })
		).rejects.toMatchObject({
			fields: {
				name: expect.any(String),
				email: expect.any(String),
				password: expect.stringContaining('at least 8')
			}
		});
		await createUser(provisioning, {
			name: 'Pat',
			email: 'pat@example.com',
			password: 'pat-password'
		});
		await expect(
			createUser(provisioning, {
				name: 'Pat 2',
				email: 'PAT@example.com',
				password: 'pat-password'
			})
		).rejects.toMatchObject({ fields: { email: expect.stringContaining('already exists') } });
	});

	it('deletes a user with their private data but keeps the shared catalog', async () => {
		const admin = await insertUser('Admin');
		const victim = await insertUser('Victim');
		const other = await insertUser('Other');

		const machine = await createMachine(victim.id, { name: 'Row', gym: 'Gym' });
		const exercise = await createExercise(victim.id, { name: 'Seated row', usesMachine: false });
		await upsertMachineSetting(victim.id, machine.id, { configuration: 'Seat 3' });
		const { workout } = await startWorkout(victim.id);
		const block = await addWorkoutExercise(victim.id, workout.id, { exerciseId: exercise.id });
		await addSet(victim.id, block.id, { reps: 8, weight: 40 });
		const { workout: otherWorkout } = await startWorkout(other.id);

		await expect(deleteUser(admin.id, admin.id)).rejects.toBeInstanceOf(ValidationError);
		await expect(deleteUser(admin.id, 'nope')).rejects.toBeInstanceOf(NotFoundError);

		const removed = await deleteUser(admin.id, victim.id);
		expect(removed).toMatchObject({ email: victim.email, workoutCount: 1 });

		expect(await db.select().from(users).where(eq(users.id, victim.id))).toHaveLength(0);
		expect(await db.select().from(workouts)).toEqual([
			expect.objectContaining({ id: otherWorkout.id })
		]);
		expect(await db.select().from(sets)).toHaveLength(0);
		expect(await db.select().from(machineSettings)).toHaveLength(0);
		const [m] = await db.select().from(machines);
		expect(m).toMatchObject({ name: 'Row', createdBy: null });

		const listed = await listUsers();
		expect(listed.map((u) => u.name)).toEqual(['Admin', 'Other']);
		expect(listed.find((u) => u.name === 'Other')?.workoutCount).toBe(1);
	});
});
