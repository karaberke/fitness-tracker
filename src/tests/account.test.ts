import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { changeEmail, changePassword, updateProfile } from '$lib/server/account';
import { createAuth } from '$lib/server/auth/create';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { ValidationError } from '$lib/server/errors';
import { closeDbAfterAll, resetDatabase } from './helpers';

closeDbAfterAll();

const secret = 'test-secret-not-for-production';
const baseURL = 'http://localhost:5173';
const app = createAuth({ db, secret, baseURL });
const provisioning = createAuth({ db, secret, baseURL, allowSignUp: true });

/** Creates an account and signs it in; returns the cookie header a browser would send. */
async function signedIn(email: string, password: string, name = 'Person') {
	await provisioning.api.signUpEmail({ body: { email, password, name } });
	const res = await app.api.signInEmail({ body: { email, password }, asResponse: true });
	const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
	const session = await app.api.getSession({ headers: new Headers({ cookie }) });
	if (!session) throw new Error('sign-in failed');
	return { headers: new Headers({ cookie }), userId: session.user.id };
}

describe('account settings', () => {
	beforeEach(resetDatabase);

	it('updates the name of the signed-in account only', async () => {
		const alice = await signedIn('alice@example.com', 'alice-pass-1', 'Alice');
		const bob = await signedIn('bob@example.com', 'bob-pass-123', 'Bob');

		await updateProfile(app, alice.headers, { name: '  Alice B. ' });
		const rows = await db.select().from(users).orderBy(users.email);
		expect(rows.map((u) => u.name)).toEqual(['Alice B.', 'Bob']);
		expect(bob.userId).not.toBe(alice.userId);

		await expect(updateProfile(app, alice.headers, { name: '   ' })).rejects.toBeInstanceOf(
			ValidationError
		);
	});

	it('changes the email after checking the password and rejects duplicates', async () => {
		const alice = await signedIn('alice@example.com', 'alice-pass-1');
		await signedIn('bob@example.com', 'bob-pass-123');

		await expect(
			changeEmail(app, alice.userId, alice.headers, { email: 'new@example.com', password: 'nope' })
		).rejects.toMatchObject({ fields: { password: 'Wrong password' } });

		await expect(
			changeEmail(app, alice.userId, alice.headers, {
				email: 'not-an-email',
				password: 'alice-pass-1'
			})
		).rejects.toMatchObject({ fields: { email: expect.any(String) } });

		await expect(
			changeEmail(app, alice.userId, alice.headers, {
				email: 'Bob@Example.com',
				password: 'alice-pass-1'
			})
		).rejects.toMatchObject({ fields: { email: expect.stringContaining('already used') } });

		await changeEmail(app, alice.userId, alice.headers, {
			email: ' Alice.New@Example.com ',
			password: 'alice-pass-1'
		});
		const [row] = await db.select().from(users).where(eq(users.id, alice.userId));
		expect(row.email).toBe('alice.new@example.com');

		// The new address signs in; the old one no longer exists.
		await expect(
			app.api.signInEmail({ body: { email: 'alice.new@example.com', password: 'alice-pass-1' } })
		).resolves.toBeTruthy();
		await expect(
			app.api.signInEmail({ body: { email: 'alice@example.com', password: 'alice-pass-1' } })
		).rejects.toThrow();
	});

	it('changes the password, keeps this session and revokes the others', async () => {
		const alice = await signedIn('alice@example.com', 'alice-pass-1');
		const phone = await app.api.signInEmail({
			body: { email: 'alice@example.com', password: 'alice-pass-1' },
			asResponse: true
		});
		const phoneHeaders = new Headers({
			cookie: (phone.headers.get('set-cookie') ?? '').split(';')[0]
		});
		expect(await app.api.getSession({ headers: phoneHeaders })).not.toBeNull();

		await expect(
			changePassword(app, alice.headers, {
				currentPassword: 'wrong',
				newPassword: 'brand-new-pass',
				confirmPassword: 'brand-new-pass'
			})
		).rejects.toMatchObject({ fields: { currentPassword: 'Wrong password' } });

		await expect(
			changePassword(app, alice.headers, {
				currentPassword: 'alice-pass-1',
				newPassword: 'short',
				confirmPassword: 'other'
			})
		).rejects.toMatchObject({
			fields: {
				newPassword: expect.stringContaining('at least 8'),
				confirmPassword: expect.any(String)
			}
		});

		const { headers } = await changePassword(app, alice.headers, {
			currentPassword: 'alice-pass-1',
			newPassword: 'brand-new-pass',
			confirmPassword: 'brand-new-pass'
		});
		const fresh = new Headers({ cookie: (headers.get('set-cookie') ?? '').split(';')[0] });
		expect(await app.api.getSession({ headers: fresh })).not.toBeNull();
		expect(await app.api.getSession({ headers: phoneHeaders })).toBeNull();

		await expect(
			app.api.signInEmail({ body: { email: 'alice@example.com', password: 'alice-pass-1' } })
		).rejects.toThrow();
		await expect(
			app.api.signInEmail({ body: { email: 'alice@example.com', password: 'brand-new-pass' } })
		).resolves.toBeTruthy();
	});

	it('refuses account changes without a session', async () => {
		await signedIn('alice@example.com', 'alice-pass-1');
		await expect(updateProfile(app, new Headers(), { name: 'Mallory' })).rejects.toThrow();
		await expect(
			changePassword(app, new Headers(), {
				currentPassword: 'alice-pass-1',
				newPassword: 'brand-new-pass',
				confirmPassword: 'brand-new-pass'
			})
		).rejects.toThrow();
	});
});
