import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, type DbClient } from './db';
import { machines, machineSettings, type Machine, type MachineSetting } from './db/schema';
import { rethrowUnique } from './db/util';
import { NotFoundError } from './errors';
import { FieldErrors, optionalText, requiredText } from './validate';

export interface MachineInput {
	name?: unknown;
	gym?: unknown;
	model?: unknown;
	notes?: unknown;
}

export interface MachineSettingInput {
	configuration?: unknown;
	notes?: unknown;
}

function parseMachine(input: MachineInput) {
	const errors = new FieldErrors();
	const data = {
		name: requiredText(input.name, errors, 'name', 120),
		gym: optionalText(input.gym, errors, 'gym', 120),
		model: optionalText(input.model, errors, 'model', 120),
		notes: optionalText(input.notes, errors, 'notes', 2000)
	};
	errors.throwIfAny();
	return data;
}

const DUPLICATE = 'A machine with this name already exists at this gym';

// ───────────────────────── Shared catalog ─────────────────────────

export async function listMachines(
	{ includeArchived = false }: { includeArchived?: boolean } = {},
	client: DbClient = db
): Promise<Machine[]> {
	return client
		.select()
		.from(machines)
		.where(includeArchived ? undefined : isNull(machines.archivedAt))
		.orderBy(asc(machines.gym), asc(machines.name));
}

export async function getMachine(id: number, client: DbClient = db): Promise<Machine> {
	const [row] = await client.select().from(machines).where(eq(machines.id, id));
	if (!row) throw new NotFoundError('Machine');
	return row;
}

export async function createMachine(
	createdBy: string,
	input: MachineInput,
	client: DbClient = db
): Promise<Machine> {
	const data = parseMachine(input);
	try {
		const [row] = await client
			.insert(machines)
			.values({ ...data, createdBy })
			.returning();
		return row;
	} catch (e) {
		rethrowUnique(e, 'name', DUPLICATE);
	}
}

export async function updateMachine(
	id: number,
	input: MachineInput,
	client: DbClient = db
): Promise<Machine> {
	const data = parseMachine(input);
	try {
		const [row] = await client.update(machines).set(data).where(eq(machines.id, id)).returning();
		if (!row) throw new NotFoundError('Machine');
		return row;
	} catch (e) {
		rethrowUnique(e, 'name', DUPLICATE);
	}
}

export async function setMachineArchived(
	id: number,
	archived: boolean,
	client: DbClient = db
): Promise<Machine> {
	const [row] = await client
		.update(machines)
		.set({ archivedAt: archived ? new Date() : null })
		.where(eq(machines.id, id))
		.returning();
	if (!row) throw new NotFoundError('Machine');
	return row;
}

// ───────────────────────── Personal defaults (private per user) ─────────────────────────

/** All of one user's saved machine defaults, keyed by machine id. */
export async function listMachineSettings(
	userId: string,
	client: DbClient = db
): Promise<Map<number, MachineSetting>> {
	const rows = await client
		.select()
		.from(machineSettings)
		.where(eq(machineSettings.userId, userId));
	return new Map(rows.map((r) => [r.machineId, r]));
}

export async function getMachineSetting(
	userId: string,
	machineId: number,
	client: DbClient = db
): Promise<MachineSetting | null> {
	const [row] = await client
		.select()
		.from(machineSettings)
		.where(and(eq(machineSettings.userId, userId), eq(machineSettings.machineId, machineId)));
	return row ?? null;
}

/** Creates or replaces the caller's default configuration for a machine. */
export async function upsertMachineSetting(
	userId: string,
	machineId: number,
	input: MachineSettingInput,
	client: DbClient = db
): Promise<MachineSetting> {
	const errors = new FieldErrors();
	const data = {
		configuration: requiredText(input.configuration, errors, 'configuration', 500),
		notes: optionalText(input.notes, errors, 'notes', 2000)
	};
	errors.throwIfAny();
	await getMachine(machineId, client); // 404 for unknown machines
	const [row] = await client
		.insert(machineSettings)
		.values({ userId, machineId, ...data })
		.onConflictDoUpdate({
			target: [machineSettings.userId, machineSettings.machineId],
			set: { ...data, updatedAt: new Date() }
		})
		.returning();
	return row;
}

export async function deleteMachineSetting(
	userId: string,
	machineId: number,
	client: DbClient = db
): Promise<void> {
	await client
		.delete(machineSettings)
		.where(and(eq(machineSettings.userId, userId), eq(machineSettings.machineId, machineId)));
}
