import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, type DbClient } from './db';
import {
	exercises,
	machines,
	machineSettings,
	sets,
	workoutExercises,
	workouts,
	type Exercise,
	type Machine,
	type Workout,
	type WorkoutExercise,
	type WorkoutSet
} from './db/schema';
import { isUniqueViolation } from './db/util';
import { NotFoundError, ValidationError } from './errors';
import { FieldErrors, idField, intField, numberField, oneOf, optionalText } from './validate';

export const UNITS = ['kg', 'lb'] as const;
export type Unit = (typeof UNITS)[number];

export interface WorkoutInput {
	title?: unknown;
	notes?: unknown;
}

export interface WorkoutExerciseInput {
	exerciseId?: unknown;
	machineId?: unknown;
	machineConfiguration?: unknown;
	notes?: unknown;
}

export interface SetInput {
	reps?: unknown;
	weight?: unknown;
	unit?: unknown;
	/** Optional: overrides (and becomes) the block's current machine configuration. */
	machineConfiguration?: unknown;
}

export interface WorkoutSummary extends Workout {
	exerciseCount: number;
	setCount: number;
	exerciseNames: string[];
}

export interface WorkoutExerciseDetail extends WorkoutExercise {
	exercise: Exercise;
	machine: Machine | null;
	sets: WorkoutSet[];
}

export interface WorkoutDetail extends Workout {
	exercises: WorkoutExerciseDetail[];
}

const ACTIVE_WORKOUT_EXISTS = 'You already have a workout in progress. Finish it first.';

// ───────────────────────── Ownership helpers ─────────────────────────
// Every lookup is scoped by userId so a record owned by someone else is
// indistinguishable from one that does not exist.

async function ownedWorkout(client: DbClient, userId: string, workoutId: number): Promise<Workout> {
	const [row] = await client
		.select()
		.from(workouts)
		.where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
	if (!row) throw new NotFoundError('Workout');
	return row;
}

async function ownedWorkoutExercise(
	client: DbClient,
	userId: string,
	workoutExerciseId: number
): Promise<{ we: WorkoutExercise; exercise: Exercise }> {
	const [row] = await client
		.select({ we: workoutExercises, exercise: exercises })
		.from(workoutExercises)
		.innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
		.innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
		.where(and(eq(workoutExercises.id, workoutExerciseId), eq(workouts.userId, userId)));
	if (!row) throw new NotFoundError('Workout exercise');
	return row;
}

async function ownedSet(
	client: DbClient,
	userId: string,
	setId: number
): Promise<{ set: WorkoutSet; we: WorkoutExercise; exercise: Exercise }> {
	const [row] = await client
		.select({ set: sets, we: workoutExercises, exercise: exercises })
		.from(sets)
		.innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
		.innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
		.innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
		.where(and(eq(sets.id, setId), eq(workouts.userId, userId)));
	if (!row) throw new NotFoundError('Set');
	return row;
}

async function touchWorkout(client: DbClient, workoutId: number) {
	await client.update(workouts).set({ updatedAt: new Date() }).where(eq(workouts.id, workoutId));
}

// ───────────────────────── Workouts ─────────────────────────

export async function listWorkouts(
	userId: string,
	client: DbClient = db
): Promise<WorkoutSummary[]> {
	const rows = await client
		.select()
		.from(workouts)
		.where(eq(workouts.userId, userId))
		.orderBy(desc(workouts.startedAt));
	if (rows.length === 0) return [];

	const stats = await client
		.select({
			workoutId: workoutExercises.workoutId,
			exerciseName: exercises.name,
			position: workoutExercises.position,
			setCount: sql<number>`count(${sets.id})::int`
		})
		.from(workoutExercises)
		.innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
		.leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
		.where(
			inArray(
				workoutExercises.workoutId,
				rows.map((w) => w.id)
			)
		)
		.groupBy(workoutExercises.id, exercises.name)
		.orderBy(asc(workoutExercises.position));

	const byWorkout = new Map<number, { names: string[]; setCount: number }>();
	for (const s of stats) {
		const entry = byWorkout.get(s.workoutId) ?? { names: [], setCount: 0 };
		entry.names.push(s.exerciseName);
		entry.setCount += s.setCount;
		byWorkout.set(s.workoutId, entry);
	}
	return rows.map((w) => {
		const s = byWorkout.get(w.id);
		return {
			...w,
			exerciseCount: s?.names.length ?? 0,
			setCount: s?.setCount ?? 0,
			exerciseNames: s?.names ?? []
		};
	});
}

export async function getActiveWorkout(
	userId: string,
	client: DbClient = db
): Promise<Workout | null> {
	const [row] = await client
		.select()
		.from(workouts)
		.where(and(eq(workouts.userId, userId), isNull(workouts.finishedAt)));
	return row ?? null;
}

/** Starts a workout, or returns the in-progress one so the caller can resume it. */
export async function startWorkout(
	userId: string,
	input: WorkoutInput = {},
	client: DbClient = db
): Promise<{ workout: Workout; resumed: boolean }> {
	const active = await getActiveWorkout(userId, client);
	if (active) return { workout: active, resumed: true };
	const errors = new FieldErrors();
	const title = optionalText(input.title, errors, 'title', 120);
	errors.throwIfAny();
	try {
		const [workout] = await client.insert(workouts).values({ userId, title }).returning();
		return { workout, resumed: false };
	} catch (e) {
		if (isUniqueViolation(e)) {
			const existing = await getActiveWorkout(userId, client);
			if (existing) return { workout: existing, resumed: true };
		}
		throw e;
	}
}

export async function getWorkout(userId: string, workoutId: number, client: DbClient = db) {
	return ownedWorkout(client, userId, workoutId);
}

export async function getWorkoutDetail(
	userId: string,
	workoutId: number,
	client: DbClient = db
): Promise<WorkoutDetail> {
	const workout = await ownedWorkout(client, userId, workoutId);
	const blocks = await client
		.select({ we: workoutExercises, exercise: exercises, machine: machines })
		.from(workoutExercises)
		.innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
		.leftJoin(machines, eq(machines.id, workoutExercises.machineId))
		.where(eq(workoutExercises.workoutId, workoutId))
		.orderBy(asc(workoutExercises.position), asc(workoutExercises.id));

	const setRows = blocks.length
		? await client
				.select()
				.from(sets)
				.where(
					inArray(
						sets.workoutExerciseId,
						blocks.map((b) => b.we.id)
					)
				)
				.orderBy(asc(sets.position), asc(sets.id))
		: [];

	const setsByBlock = new Map<number, WorkoutSet[]>();
	for (const s of setRows) {
		const list = setsByBlock.get(s.workoutExerciseId) ?? [];
		list.push(s);
		setsByBlock.set(s.workoutExerciseId, list);
	}
	return {
		...workout,
		exercises: blocks.map((b) => ({
			...b.we,
			exercise: b.exercise,
			machine: b.machine,
			sets: setsByBlock.get(b.we.id) ?? []
		}))
	};
}

export async function updateWorkout(
	userId: string,
	workoutId: number,
	input: WorkoutInput,
	client: DbClient = db
): Promise<Workout> {
	await ownedWorkout(client, userId, workoutId);
	const errors = new FieldErrors();
	const data = {
		title: optionalText(input.title, errors, 'title', 120),
		notes: optionalText(input.notes, errors, 'notes', 5000)
	};
	errors.throwIfAny();
	const [row] = await client
		.update(workouts)
		.set(data)
		.where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
		.returning();
	return row;
}

export async function finishWorkout(
	userId: string,
	workoutId: number,
	client: DbClient = db
): Promise<Workout> {
	await ownedWorkout(client, userId, workoutId);
	const [row] = await client
		.update(workouts)
		.set({ finishedAt: new Date() })
		.where(
			and(eq(workouts.id, workoutId), eq(workouts.userId, userId), isNull(workouts.finishedAt))
		)
		.returning();
	return row ?? (await ownedWorkout(client, userId, workoutId));
}

/** Re-opens a finished workout so more sets can be logged. Fails if another workout is active. */
export async function reopenWorkout(
	userId: string,
	workoutId: number,
	client: DbClient = db
): Promise<Workout> {
	await ownedWorkout(client, userId, workoutId);
	try {
		const [row] = await client
			.update(workouts)
			.set({ finishedAt: null })
			.where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
			.returning();
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) throw new ValidationError({ workout: ACTIVE_WORKOUT_EXISTS });
		throw e;
	}
}

export async function deleteWorkout(
	userId: string,
	workoutId: number,
	client: DbClient = db
): Promise<void> {
	await ownedWorkout(client, userId, workoutId);
	await client.delete(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
}

// ───────────────────────── Exercises within a workout ─────────────────────────

/**
 * Adds an exercise block to a workout. When no machine is chosen, the
 * exercise's linked default machine is used (unless archived). When a machine
 * is in play and no configuration is given, the user's saved default for that
 * machine is copied in — a snapshot, so later changes never alter this record.
 */
export async function addWorkoutExercise(
	userId: string,
	workoutId: number,
	input: WorkoutExerciseInput,
	client: DbClient = db
): Promise<WorkoutExercise> {
	const errors = new FieldErrors();
	const exerciseId = idField(input.exerciseId, errors, 'exerciseId');
	let machineId = idField(input.machineId, errors, 'machineId', true);
	let machineConfiguration = optionalText(
		input.machineConfiguration,
		errors,
		'machineConfiguration'
	);
	const notes = optionalText(input.notes, errors, 'notes', 2000);
	errors.throwIfAny();

	return client.transaction(async (tx) => {
		await ownedWorkout(tx, userId, workoutId);
		const [exercise] = await tx.select().from(exercises).where(eq(exercises.id, exerciseId!));
		if (!exercise) throw new ValidationError({ exerciseId: 'Choose an exercise' });
		if (machineId == null && exercise.machineId != null) {
			const [linked] = await tx.select().from(machines).where(eq(machines.id, exercise.machineId));
			if (linked && !linked.archivedAt) machineId = linked.id;
		}
		if (machineId != null) {
			const [machine] = await tx.select().from(machines).where(eq(machines.id, machineId));
			if (!machine) throw new ValidationError({ machineId: 'Choose a machine' });
			if (!machineConfiguration) {
				const [setting] = await tx
					.select()
					.from(machineSettings)
					.where(and(eq(machineSettings.userId, userId), eq(machineSettings.machineId, machineId)));
				machineConfiguration = setting?.configuration ?? null;
			}
		} else {
			machineConfiguration = null;
		}
		const [{ next }] = await tx
			.select({ next: sql<number>`coalesce(max(${workoutExercises.position}), 0) + 1` })
			.from(workoutExercises)
			.where(eq(workoutExercises.workoutId, workoutId));
		const [row] = await tx
			.insert(workoutExercises)
			.values({
				workoutId,
				exerciseId: exercise.id,
				machineId,
				machineConfiguration,
				notes,
				position: next
			})
			.returning();
		await touchWorkout(tx, workoutId);
		return row;
	});
}

/** Updates the block's machine / configuration / notes. Sets already logged keep their snapshot. */
export async function updateWorkoutExercise(
	userId: string,
	workoutExerciseId: number,
	input: { machineId?: unknown; machineConfiguration?: unknown; notes?: unknown },
	client: DbClient = db
): Promise<WorkoutExercise> {
	const errors = new FieldErrors();
	const machineId = idField(input.machineId, errors, 'machineId', true);
	const machineConfiguration = optionalText(
		input.machineConfiguration,
		errors,
		'machineConfiguration'
	);
	const notes = optionalText(input.notes, errors, 'notes', 2000);
	errors.throwIfAny();

	return client.transaction(async (tx) => {
		const { we } = await ownedWorkoutExercise(tx, userId, workoutExerciseId);
		if (machineId != null) {
			const [machine] = await tx.select().from(machines).where(eq(machines.id, machineId));
			if (!machine) throw new ValidationError({ machineId: 'Choose a machine' });
		}
		const [row] = await tx
			.update(workoutExercises)
			.set({
				machineId,
				machineConfiguration: machineId == null ? null : machineConfiguration,
				notes
			})
			.where(eq(workoutExercises.id, we.id))
			.returning();
		await touchWorkout(tx, we.workoutId);
		return row;
	});
}

export async function removeWorkoutExercise(
	userId: string,
	workoutExerciseId: number,
	client: DbClient = db
): Promise<void> {
	await client.transaction(async (tx) => {
		const { we } = await ownedWorkoutExercise(tx, userId, workoutExerciseId);
		await tx.delete(workoutExercises).where(eq(workoutExercises.id, we.id));
		await touchWorkout(tx, we.workoutId);
	});
}

// ───────────────────────── Sets ─────────────────────────

export function parseSet(input: SetInput, exercise: Pick<Exercise, 'isBodyweight'>) {
	const errors = new FieldErrors();
	const reps = intField(input.reps, errors, 'reps', { min: 1, max: 1000 });
	const weight = numberField(input.weight, errors, 'weight', {
		min: 0,
		max: 99999,
		optional: exercise.isBodyweight
	});
	const unit = oneOf(input.unit, UNITS, errors, 'unit', 'kg');
	const machineConfiguration = optionalText(
		input.machineConfiguration,
		errors,
		'machineConfiguration'
	);
	if (!errors.fields.weight && !exercise.isBodyweight && (weight ?? 0) <= 0) {
		errors.add('weight', 'Enter the weight used (or mark the exercise as bodyweight)');
	}
	errors.throwIfAny();
	return {
		reps: reps!,
		weight: Math.round((weight ?? 0) * 100) / 100,
		unit,
		machineConfiguration
	};
}

/**
 * Logs a set. The machine configuration in force at this moment is copied onto
 * the set, so the historical record is independent of later changes. Passing a
 * configuration that differs from the block's current one updates the block for
 * the sets that follow (configuration changes between sets).
 */
export async function addSet(
	userId: string,
	workoutExerciseId: number,
	input: SetInput,
	client: DbClient = db
): Promise<WorkoutSet> {
	return client.transaction(async (tx) => {
		const { we, exercise } = await ownedWorkoutExercise(tx, userId, workoutExerciseId);
		const data = parseSet(input, exercise);
		let configuration = we.machineConfiguration;
		if (we.machineId != null && input.machineConfiguration !== undefined) {
			configuration = data.machineConfiguration;
			if (configuration !== we.machineConfiguration) {
				await tx
					.update(workoutExercises)
					.set({ machineConfiguration: configuration })
					.where(eq(workoutExercises.id, we.id));
			}
		}
		const [{ next }] = await tx
			.select({ next: sql<number>`coalesce(max(${sets.position}), 0) + 1` })
			.from(sets)
			.where(eq(sets.workoutExerciseId, we.id));
		const [row] = await tx
			.insert(sets)
			.values({
				workoutExerciseId: we.id,
				position: next,
				reps: data.reps,
				weight: data.weight,
				unit: data.unit,
				machineConfiguration: we.machineId == null ? null : configuration
			})
			.returning();
		await touchWorkout(tx, we.workoutId);
		return row;
	});
}

export async function updateSet(
	userId: string,
	setId: number,
	input: SetInput,
	client: DbClient = db
): Promise<WorkoutSet> {
	return client.transaction(async (tx) => {
		const { set, we, exercise } = await ownedSet(tx, userId, setId);
		const data = parseSet(input, exercise);
		const [row] = await tx
			.update(sets)
			.set({
				reps: data.reps,
				weight: data.weight,
				unit: data.unit,
				machineConfiguration:
					input.machineConfiguration === undefined || we.machineId == null
						? set.machineConfiguration
						: data.machineConfiguration
			})
			.where(eq(sets.id, set.id))
			.returning();
		await touchWorkout(tx, we.workoutId);
		return row;
	});
}

export async function deleteSet(
	userId: string,
	setId: number,
	client: DbClient = db
): Promise<void> {
	await client.transaction(async (tx) => {
		const { set, we } = await ownedSet(tx, userId, setId);
		await tx.delete(sets).where(eq(sets.id, set.id));
		await touchWorkout(tx, we.workoutId);
	});
}

/** Most recent sets of an exercise from earlier workouts, to pre-fill the next entry. */
export async function lastSetsForExercise(
	userId: string,
	exerciseId: number,
	excludeWorkoutId: number,
	client: DbClient = db
): Promise<WorkoutSet[]> {
	const [last] = await client
		.select({ id: workoutExercises.id })
		.from(workoutExercises)
		.innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
		.where(
			and(
				eq(workouts.userId, userId),
				eq(workoutExercises.exerciseId, exerciseId),
				sql`${workoutExercises.workoutId} <> ${excludeWorkoutId}`
			)
		)
		.orderBy(desc(workouts.startedAt), desc(workoutExercises.id))
		.limit(1);
	if (!last) return [];
	return client
		.select()
		.from(sets)
		.where(eq(sets.workoutExerciseId, last.id))
		.orderBy(asc(sets.position), asc(sets.id));
}

/** Dashboard numbers for the signed-in user. */
export async function workoutStats(userId: string, client: DbClient = db) {
	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const [row] = await client
		.select({
			total: sql<number>`count(*)::int`,
			thisWeek: sql<number>`count(*) filter (where ${workouts.startedAt} >= ${weekAgo.toISOString()}::timestamptz)::int`
		})
		.from(workouts)
		.where(eq(workouts.userId, userId));
	return row ?? { total: 0, thisWeek: 0 };
}
