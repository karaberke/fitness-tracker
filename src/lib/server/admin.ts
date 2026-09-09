import { count, eq } from 'drizzle-orm';
import { MIN_PASSWORD_LENGTH, type Auth } from './auth/create';
import { db } from './db';
import { users, workouts, type UserRole } from './db/schema';
import { rethrowUnique } from './db/util';
import { NotFoundError, ValidationError } from './errors';
import { boolField, FieldErrors, requiredText } from './validate';

/**
 * User management for administrators. Callers must have checked the admin role
 * (see `requireAdmin`); these functions trust `adminId` only to stop an admin
 * from deleting their own account.
 */

export interface ManagedUser {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	createdAt: Date;
	workoutCount: number;
}

export interface NewUserInput {
	name?: string;
	email?: string;
	password?: string;
	admin?: string | boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers(): Promise<ManagedUser[]> {
	return db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
			createdAt: users.createdAt,
			workoutCount: count(workouts.id)
		})
		.from(users)
		.leftJoin(workouts, eq(workouts.userId, users.id))
		.groupBy(users.id)
		.orderBy(users.createdAt, users.email);
}

/** Creates an account through Better Auth (so the password hash matches sign-in). */
export async function createUser(provisioning: Auth, input: NewUserInput): Promise<ManagedUser> {
	const errors = new FieldErrors();
	const name = requiredText(input.name, errors, 'name', 120);
	const email = requiredText(input.email, errors, 'email', 254).toLowerCase();
	if (email && !EMAIL_RE.test(email)) errors.add('email', 'Enter a valid email address');
	const password = input.password ?? '';
	if (password.length < MIN_PASSWORD_LENGTH) {
		errors.add('password', `Must be at least ${MIN_PASSWORD_LENGTH} characters`);
	} else if (password.length > 128) {
		errors.add('password', 'Must be 128 characters or fewer');
	}
	const role: UserRole = boolField(input.admin) ? 'admin' : 'user';
	errors.throwIfAny();

	const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
	if (existing) throw new ValidationError({ email: 'An account with this email already exists' });

	let userId: string;
	try {
		const res = await provisioning.api.signUpEmail({ body: { email, password, name } });
		userId = res.user.id;
	} catch (e) {
		rethrowUnique(e, 'email', 'An account with this email already exists');
	}
	const [row] = await db
		.update(users)
		.set({ role, updatedAt: new Date() })
		.where(eq(users.id, userId))
		.returning();
	return { ...row, workoutCount: 0 };
}

/**
 * Deletes an account and, through foreign-key cascades, its sessions, personal
 * machine setups, workouts and sets. Shared catalog entries they created stay
 * (their `created_by` becomes null).
 */
export async function deleteUser(adminId: string, userId: string): Promise<ManagedUser> {
	if (userId === adminId) {
		throw new ValidationError({ userId: 'You cannot delete your own account' });
	}
	return db.transaction(async (tx) => {
		const [target] = await tx.select().from(users).where(eq(users.id, userId));
		if (!target) throw new NotFoundError('User');
		const [{ n }] = await tx
			.select({ n: count() })
			.from(workouts)
			.where(eq(workouts.userId, userId));
		await tx.delete(users).where(eq(users.id, userId));
		return { ...target, workoutCount: n };
	});
}
