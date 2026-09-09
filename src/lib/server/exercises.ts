import { asc, eq, isNull } from 'drizzle-orm';
import { db, type DbClient } from './db';
import { exercises, machines, type Exercise, type Machine } from './db/schema';
import { rethrowUnique } from './db/util';
import { NotFoundError, ValidationError } from './errors';
import { boolField, FieldErrors, idField, optionalText, requiredText } from './validate';

export interface ExerciseInput {
	name?: unknown;
	category?: unknown;
	isBodyweight?: unknown;
	/** Checkbox: the exercise is done on a machine. Requires `machineId`. */
	usesMachine?: unknown;
	/** Default machine, pre-selected when the exercise is added to a workout. */
	machineId?: unknown;
	notes?: unknown;
}

export interface ExerciseWithMachine extends Exercise {
	machine: Machine | null;
}

async function parseExercise(input: ExerciseInput, client: DbClient) {
	const errors = new FieldErrors();
	const usesMachine = boolField(input.usesMachine);
	const machineId = usesMachine ? idField(input.machineId, errors, 'machineId', true) : null;
	if (usesMachine && machineId == null)
		errors.add('machineId', 'Choose the machine this exercise uses');
	const data = {
		name: requiredText(input.name, errors, 'name', 120),
		category: optionalText(input.category, errors, 'category', 60),
		isBodyweight: boolField(input.isBodyweight),
		usesMachine,
		machineId,
		notes: optionalText(input.notes, errors, 'notes', 2000)
	};
	errors.throwIfAny();
	if (machineId != null) {
		const [machine] = await client.select().from(machines).where(eq(machines.id, machineId));
		if (!machine) throw new ValidationError({ machineId: 'Choose the machine this exercise uses' });
	}
	return data;
}

const DUPLICATE = 'An exercise with this name already exists';

/** Exercises are shared between all accounts: every signed-in user may read and edit them. */
export async function listExercises(
	{ includeArchived = false }: { includeArchived?: boolean } = {},
	client: DbClient = db
): Promise<Exercise[]> {
	return client
		.select()
		.from(exercises)
		.where(includeArchived ? undefined : isNull(exercises.archivedAt))
		.orderBy(asc(exercises.name));
}

/** Same as listExercises, with the linked default machine joined in. */
export async function listExercisesWithMachine(
	{ includeArchived = false }: { includeArchived?: boolean } = {},
	client: DbClient = db
): Promise<ExerciseWithMachine[]> {
	const rows = await client
		.select({ exercise: exercises, machine: machines })
		.from(exercises)
		.leftJoin(machines, eq(machines.id, exercises.machineId))
		.where(includeArchived ? undefined : isNull(exercises.archivedAt))
		.orderBy(asc(exercises.name));
	return rows.map((r) => ({ ...r.exercise, machine: r.machine }));
}

export async function getExercise(id: number, client: DbClient = db): Promise<ExerciseWithMachine> {
	const [row] = await client
		.select({ exercise: exercises, machine: machines })
		.from(exercises)
		.leftJoin(machines, eq(machines.id, exercises.machineId))
		.where(eq(exercises.id, id));
	if (!row) throw new NotFoundError('Exercise');
	return { ...row.exercise, machine: row.machine };
}

/** Exercises linked to a machine (shown on the machine page). */
export async function listExercisesForMachine(
	machineId: number,
	client: DbClient = db
): Promise<Exercise[]> {
	return client
		.select()
		.from(exercises)
		.where(eq(exercises.machineId, machineId))
		.orderBy(asc(exercises.name));
}

export async function createExercise(
	createdBy: string,
	input: ExerciseInput,
	client: DbClient = db
): Promise<Exercise> {
	const data = await parseExercise(input, client);
	try {
		const [row] = await client
			.insert(exercises)
			.values({ ...data, createdBy })
			.returning();
		return row;
	} catch (e) {
		rethrowUnique(e, 'name', DUPLICATE);
	}
}

export async function updateExercise(
	id: number,
	input: ExerciseInput,
	client: DbClient = db
): Promise<Exercise> {
	const data = await parseExercise(input, client);
	try {
		const [row] = await client.update(exercises).set(data).where(eq(exercises.id, id)).returning();
		if (!row) throw new NotFoundError('Exercise');
		return row;
	} catch (e) {
		rethrowUnique(e, 'name', DUPLICATE);
	}
}

/** Archiving hides an exercise from pickers; workout history keeps referencing it. */
export async function setExerciseArchived(
	id: number,
	archived: boolean,
	client: DbClient = db
): Promise<Exercise> {
	const [row] = await client
		.update(exercises)
		.set({ archivedAt: archived ? new Date() : null })
		.where(eq(exercises.id, id))
		.returning();
	if (!row) throw new NotFoundError('Exercise');
	return row;
}
