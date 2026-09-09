import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { MIN_PASSWORD_LENGTH, type Auth } from './auth/create';
import { db } from './db';
import { users } from './db/schema';
import { rethrowUnique } from './db/util';
import { ValidationError } from './errors';
import { FieldErrors, requiredText } from './validate';

/**
 * Self-service account settings. Every function works on the account behind
 * the request's session cookie (`headers`), so a user can only ever change
 * their own name, email or password. Better Auth does the password handling;
 * the email change is a direct update because Better Auth's own change-email
 * flow needs an email provider for verification, which this app doesn't have.
 */

export interface ProfileInput {
	name?: string;
}

export interface EmailInput {
	email?: string;
	password?: string;
}

export interface PasswordInput {
	currentPassword?: string;
	newPassword?: string;
	confirmPassword?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

const apiCode = (e: unknown): string | undefined => {
	if (!(e instanceof APIError)) return undefined;
	const body = e.body as { code?: unknown; message?: unknown } | undefined;
	if (typeof body?.code === 'string') return body.code;
	// Older shapes only carry the message text; normalise it to a code-like string.
	if (typeof body?.message === 'string') return body.message.toUpperCase().replace(/\s+/g, '_');
	return undefined;
};

/** Throws a field error when `password` is not the account's current password. */
async function assertCurrentPassword(
	auth: Auth,
	headers: Headers,
	password: string,
	field: string
) {
	try {
		await auth.api.verifyPassword({ body: { password }, headers });
	} catch (e) {
		const code = apiCode(e);
		if (code === 'INVALID_PASSWORD') throw new ValidationError({ [field]: 'Wrong password' });
		if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
			throw new ValidationError({ [field]: 'This account has no password set' });
		}
		throw e;
	}
}

export async function updateProfile(auth: Auth, headers: Headers, input: ProfileInput) {
	const errors = new FieldErrors();
	const name = requiredText(input.name, errors, 'name', 120);
	errors.throwIfAny();
	await auth.api.updateUser({ body: { name }, headers });
	return { name };
}

export async function changeEmail(auth: Auth, userId: string, headers: Headers, input: EmailInput) {
	const errors = new FieldErrors();
	const email = requiredText(input.email, errors, 'email', 254).toLowerCase();
	if (email && !EMAIL_RE.test(email)) errors.add('email', 'Enter a valid email address');
	const password = input.password ?? '';
	if (!password) errors.add('password', 'Enter your current password to change the email');
	errors.throwIfAny();

	await assertCurrentPassword(auth, headers, password, 'password');
	try {
		await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, userId));
	} catch (e) {
		rethrowUnique(e, 'email', 'That email is already used by another account');
	}
	return { email };
}

export async function changePassword(auth: Auth, headers: Headers, input: PasswordInput) {
	const errors = new FieldErrors();
	const currentPassword = input.currentPassword ?? '';
	const newPassword = input.newPassword ?? '';
	const confirmPassword = input.confirmPassword ?? '';
	if (!currentPassword) errors.add('currentPassword', 'Enter your current password');
	if (newPassword.length < MIN_PASSWORD_LENGTH) {
		errors.add('newPassword', `Must be at least ${MIN_PASSWORD_LENGTH} characters`);
	} else if (newPassword.length > MAX_PASSWORD_LENGTH) {
		errors.add('newPassword', `Must be ${MAX_PASSWORD_LENGTH} characters or fewer`);
	} else if (newPassword === currentPassword) {
		errors.add('newPassword', 'Choose a password different from the current one');
	}
	if (confirmPassword !== newPassword) errors.add('confirmPassword', 'Passwords do not match');
	errors.throwIfAny();

	try {
		// Signs every other device out and issues a fresh session for this one.
		return await auth.api.changePassword({
			body: { currentPassword, newPassword, revokeOtherSessions: true },
			headers,
			returnHeaders: true
		});
	} catch (e) {
		const code = apiCode(e);
		if (code === 'INVALID_PASSWORD')
			throw new ValidationError({ currentPassword: 'Wrong password' });
		if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
			throw new ValidationError({ currentPassword: 'This account has no password set' });
		}
		throw e;
	}
}
