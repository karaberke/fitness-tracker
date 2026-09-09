import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

// ───────────────────────── Authentication (managed by Better Auth) ─────────────────────────

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		/** 'admin' unlocks user management on the settings page. Set server-side only. */
		role: text('role').$type<UserRole>().notNull().default('user'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('users_role_check', sql`${t.role} in ('user', 'admin')`)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

export const accounts = pgTable(
	'accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('accounts_user_id_idx').on(t.userId)]
);

export const verifications = pgTable(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('verifications_identifier_idx').on(t.identifier)]
);

// ───────────────────────── Catalog (shared between all accounts) ─────────────────────────

export const machines = pgTable(
	'machines',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		gym: text('gym'),
		model: text('model'),
		notes: text('notes'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		...timestamps
	},
	(t) => [
		uniqueIndex('machines_name_gym_unique').on(
			sql`lower(${t.name})`,
			sql`lower(coalesce(${t.gym}, ''))`
		)
	]
);

export const exercises = pgTable(
	'exercises',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		/** Muscle group or category, e.g. "Back", "Legs". */
		category: text('category'),
		/** Bodyweight exercises may be logged with zero external weight. */
		isBodyweight: boolean('is_bodyweight').notNull().default(false),
		/** Exercise is performed on a machine; `machineId` is the default one. */
		usesMachine: boolean('uses_machine').notNull().default(false),
		machineId: integer('machine_id').references(() => machines.id, { onDelete: 'set null' }),
		notes: text('notes'),
		/** Soft delete: archived exercises are hidden from pickers but stay in history. */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		...timestamps
	},
	(t) => [uniqueIndex('exercises_name_unique').on(sql`lower(${t.name})`)]
);

/** A user's personal default configuration for a machine (seat 4, backrest 2, rope attachment…). */
export const machineSettings = pgTable(
	'machine_settings',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		machineId: integer('machine_id')
			.notNull()
			.references(() => machines.id, { onDelete: 'cascade' }),
		configuration: text('configuration').notNull(),
		notes: text('notes'),
		...timestamps
	},
	(t) => [uniqueIndex('machine_settings_user_machine_unique').on(t.userId, t.machineId)]
);

// ───────────────────────── Workout log (private per user) ─────────────────────────

export const workouts = pgTable(
	'workouts',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title'),
		notes: text('notes'),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('workouts_user_started_idx').on(t.userId, t.startedAt.desc()),
		// At most one in-progress workout per user, so "resume" is unambiguous.
		uniqueIndex('workouts_one_active_per_user')
			.on(t.userId)
			.where(sql`${t.finishedAt} is null`)
	]
);

export const workoutExercises = pgTable(
	'workout_exercises',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		workoutId: integer('workout_id')
			.notNull()
			.references(() => workouts.id, { onDelete: 'cascade' }),
		// `restrict`: catalog entries referenced by history can only be archived, never deleted.
		exerciseId: integer('exercise_id')
			.notNull()
			.references(() => exercises.id, { onDelete: 'restrict' }),
		machineId: integer('machine_id').references(() => machines.id, { onDelete: 'restrict' }),
		/** Configuration currently in use for this block; copied onto each set as it is logged. */
		machineConfiguration: text('machine_configuration'),
		notes: text('notes'),
		position: integer('position').notNull(),
		...timestamps
	},
	(t) => [index('workout_exercises_workout_position_idx').on(t.workoutId, t.position)]
);

export const sets = pgTable(
	'sets',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		workoutExerciseId: integer('workout_exercise_id')
			.notNull()
			.references(() => workoutExercises.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		reps: integer('reps').notNull(),
		weight: numeric('weight', { precision: 7, scale: 2, mode: 'number' }).notNull().default(0),
		unit: text('unit').notNull().default('kg'),
		/** Snapshot of the machine configuration at the moment this set was saved. */
		machineConfiguration: text('machine_configuration'),
		...timestamps
	},
	(t) => [
		index('sets_workout_exercise_position_idx').on(t.workoutExerciseId, t.position),
		check('sets_reps_positive', sql`${t.reps} >= 1`),
		check('sets_weight_non_negative', sql`${t.weight} >= 0`),
		check('sets_unit_valid', sql`${t.unit} in ('kg', 'lb')`)
	]
);

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type MachineSetting = typeof machineSettings.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
