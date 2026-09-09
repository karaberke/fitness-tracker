import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { createAuth } from '$lib/server/auth/create';
import { closeDbAfterAll, resetDatabase } from './helpers';

closeDbAfterAll();

const secret = 'test-secret-not-for-production';
const baseURL = 'http://localhost:5173';

describe('authentication', () => {
	beforeEach(resetDatabase);

	it('blocks public sign-up but lets provisioned accounts sign in', async () => {
		const app = createAuth({ db, secret, baseURL });
		await expect(
			app.api.signUpEmail({
				body: { email: 'new@example.com', password: 'longenough1', name: 'New' }
			})
		).rejects.toThrow();

		// The provisioning script uses an instance with sign-up enabled.
		const provisioning = createAuth({ db, secret, baseURL, allowSignUp: true });
		await provisioning.api.signUpEmail({
			body: { email: 'alice@example.com', password: 'correct horse', name: 'Alice' }
		});

		await expect(
			app.api.signInEmail({ body: { email: 'alice@example.com', password: 'wrong password' } })
		).rejects.toThrow();

		const res = await app.api.signInEmail({
			body: { email: 'alice@example.com', password: 'correct horse' },
			asResponse: true
		});
		expect(res.ok).toBe(true);
		const cookie = res.headers.get('set-cookie') ?? '';
		expect(cookie).toContain('better-auth.session_token=');
		expect(cookie.toLowerCase()).toContain('httponly');

		// The cookie identifies the user on later requests.
		const headers = new Headers({ cookie: cookie.split(';')[0] });
		const session = await app.api.getSession({ headers });
		expect(session?.user.email).toBe('alice@example.com');

		await app.api.signOut({ headers });
		expect(await app.api.getSession({ headers })).toBeNull();
	});
});
