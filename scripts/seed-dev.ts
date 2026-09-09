/**
 * Development seed: two demo accounts, a small shared catalog, personal machine
 * defaults and a couple of finished workouts. Never run this against production —
 * it refuses when NODE_ENV=production. Use `pnpm user:create` for real accounts.
 *
 *   pnpm seed:dev
 *
 * Demo passwords come from DEV_SEED_PASSWORD (default: "devpass123").
 */
import { eq, sql } from 'drizzle-orm';
import { createAuth } from '../src/lib/server/auth/create';
import {
	exercises,
	machines,
	machineSettings,
	sets,
	users,
	workoutExercises,
	workouts
} from '../src/lib/server/db/schema';
import { connect, requireEnv } from './_env';

if (process.env.NODE_ENV === 'production') {
	console.error('Refusing to seed demo data in production.');
	process.exit(1);
}

const password = process.env.DEV_SEED_PASSWORD ?? 'devpass123';
const { db, client } = connect();
const auth = createAuth({
	db,
	secret: requireEnv('BETTER_AUTH_SECRET'),
	baseURL: process.env.ORIGIN || 'http://localhost:3000',
	allowSignUp: true
});

async function ensureUser(email: string, name: string, role: 'user' | 'admin' = 'user') {
	const [existing] = await db.select().from(users).where(eq(users.email, email));
	if (!existing) await auth.api.signUpEmail({ body: { email, password, name } });
	const [row] = await db.update(users).set({ role }).where(eq(users.email, email)).returning();
	return row;
}

try {
	const alex = await ensureUser('alex@example.com', 'Alex', 'admin');
	const sam = await ensureUser('sam@example.com', 'Sam');

	const machineSeed = [
		{ name: 'Chest Press', gym: 'Downtown Gym', model: 'Technogym Selection 700' },
		{ name: 'Lat Pulldown', gym: 'Downtown Gym', model: 'Life Fitness Signature' },
		{ name: 'Leg Press 45°', gym: 'Downtown Gym', model: 'Hammer Strength' },
		{ name: 'Cable Row', gym: 'Downtown Gym', model: 'Technogym', notes: 'V-bar is in the drawer' },
		{ name: 'Shoulder Press', gym: 'Home Gym', model: 'Matrix Ultra' }
	];
	const machineIds = new Map<string, number>();
	for (const m of machineSeed) {
		const [row] = await db
			.insert(machines)
			.values({ ...m, createdBy: alex.id })
			.onConflictDoNothing()
			.returning();
		const id =
			row?.id ??
			(
				await db
					.select()
					.from(machines)
					.where(
						sql`lower(${machines.name}) = ${m.name.toLowerCase()} and lower(coalesce(${machines.gym}, '')) = ${m.gym.toLowerCase()}`
					)
			)[0].id;
		machineIds.set(m.name, id);
	}

	const exerciseSeed = [
		{ name: 'Bench Press', category: 'Chest', isBodyweight: false, machine: 'Chest Press' },
		{ name: 'Lat Pulldown', category: 'Back', isBodyweight: false, machine: 'Lat Pulldown' },
		{ name: 'Leg Press', category: 'Legs', isBodyweight: false, machine: 'Leg Press 45°' },
		{ name: 'Seated Row', category: 'Back', isBodyweight: false, machine: 'Cable Row' },
		{
			name: 'Shoulder Press',
			category: 'Shoulders',
			isBodyweight: false,
			machine: 'Shoulder Press'
		},
		{ name: 'Pull-up', category: 'Back', isBodyweight: true, machine: null },
		{ name: 'Push-up', category: 'Chest', isBodyweight: true, machine: null },
		{ name: 'Dumbbell Curl', category: 'Arms', isBodyweight: false, machine: null }
	];
	const exerciseIds = new Map<string, number>();
	for (const { machine, ...e } of exerciseSeed) {
		const machineId = machine ? machineIds.get(machine)! : null;
		const [row] = await db
			.insert(exercises)
			.values({ ...e, usesMachine: machineId != null, machineId, createdBy: alex.id })
			.onConflictDoNothing()
			.returning();
		const id =
			row?.id ??
			(
				await db
					.select()
					.from(exercises)
					.where(sql`lower(${exercises.name}) = ${e.name.toLowerCase()}`)
			)[0].id;
		exerciseIds.set(e.name, id);
	}

	const settingSeed: [typeof alex, string, string][] = [
		[alex, 'Chest Press', 'Seat 4 · Handles 2'],
		[alex, 'Lat Pulldown', 'Thigh pad 3 · Wide grip'],
		[alex, 'Leg Press 45°', 'Back 2 · Feet high'],
		[sam, 'Chest Press', 'Seat 6 · Handles 3'],
		[sam, 'Cable Row', 'Chest pad 5 · V-bar']
	];
	for (const [user, machine, configuration] of settingSeed) {
		await db
			.insert(machineSettings)
			.values({ userId: user.id, machineId: machineIds.get(machine)!, configuration })
			.onConflictDoNothing();
	}

	// Sample history for Alex (only when none exists yet).
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(workouts)
		.where(eq(workouts.userId, alex.id));
	if (n === 0) {
		const day = 24 * 60 * 60 * 1000;
		type Block = {
			exercise: string;
			machine: string | null;
			config: string | null;
			sets: [number, number][];
		};
		const plan: { daysAgo: number; title: string; blocks: Block[] }[] = [
			{
				daysAgo: 5,
				title: 'Push day',
				blocks: [
					{
						exercise: 'Bench Press',
						machine: 'Chest Press',
						config: 'Seat 4 · Handles 2',
						sets: [
							[10, 40],
							[8, 50],
							[8, 50]
						]
					},
					{
						exercise: 'Shoulder Press',
						machine: 'Shoulder Press',
						config: 'Seat 3',
						sets: [
							[10, 30],
							[10, 30]
						]
					},
					{
						exercise: 'Push-up',
						machine: null,
						config: null,
						sets: [
							[15, 0],
							[12, 0]
						]
					}
				]
			},
			{
				daysAgo: 2,
				title: 'Pull day',
				blocks: [
					{
						exercise: 'Lat Pulldown',
						machine: 'Lat Pulldown',
						config: 'Thigh pad 3 · Wide grip',
						sets: [
							[12, 45],
							[10, 50],
							[10, 50]
						]
					},
					{
						exercise: 'Seated Row',
						machine: 'Cable Row',
						config: 'Chest pad 4 · V-bar',
						sets: [
							[12, 40],
							[12, 45]
						]
					},
					{
						exercise: 'Pull-up',
						machine: null,
						config: null,
						sets: [
							[8, 0],
							[6, 0],
							[5, 2.5]
						]
					}
				]
			}
		];
		for (const w of plan) {
			const startedAt = new Date(Date.now() - w.daysAgo * day);
			await db.transaction(async (tx) => {
				const [workout] = await tx
					.insert(workouts)
					.values({
						userId: alex.id,
						title: w.title,
						startedAt,
						finishedAt: new Date(startedAt.getTime() + 55 * 60 * 1000)
					})
					.returning();
				for (const [bi, b] of w.blocks.entries()) {
					const [we] = await tx
						.insert(workoutExercises)
						.values({
							workoutId: workout.id,
							exerciseId: exerciseIds.get(b.exercise)!,
							machineId: b.machine ? machineIds.get(b.machine)! : null,
							machineConfiguration: b.config,
							position: bi + 1
						})
						.returning();
					await tx.insert(sets).values(
						b.sets.map(([reps, weight], si) => ({
							workoutExerciseId: we.id,
							position: si + 1,
							reps,
							weight,
							unit: 'kg',
							machineConfiguration: b.config
						}))
					);
				}
			});
		}
	}

	console.log('Seeded demo data.');
	console.log(`  alex@example.com / ${password}  (administrator)`);
	console.log(`  sam@example.com  / ${password}`);
} finally {
	await client.end();
}
