import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from '../db/client';
import * as schema from '../db/schema';

export const MIN_PASSWORD_LENGTH = 8;

export interface CreateAuthOptions {
	db: Db;
	secret: string;
	baseURL?: string;
	/** Sign-up is disabled for the running app; only provisioning scripts enable it. */
	allowSignUp?: boolean;
	plugins?: BetterAuthOptions['plugins'];
}

/**
 * Builds a Better Auth instance. Free of SvelteKit imports so the same
 * configuration can be reused by CLI scripts and tests.
 */
export function createAuth({
	db,
	secret,
	baseURL,
	allowSignUp = false,
	plugins
}: CreateAuthOptions) {
	return betterAuth({
		secret,
		baseURL,
		database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: !allowSignUp,
			// Provisioning creates accounts for other people; never sign the caller in as them.
			autoSignIn: false,
			minPasswordLength: MIN_PASSWORD_LENGTH
		},
		user: {
			additionalFields: {
				// Read from the database onto session.user; `input: false` keeps sign-up
				// bodies from setting it. Only admin.ts and the CLI write this column.
				role: { type: 'string', required: false, defaultValue: 'user', input: false }
			}
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // refresh expiry at most once a day
			// Sessions last a month, so the default "signed in within 24h" check for
			// sensitive endpoints would lock most users out of the settings page.
			// Those actions ask for the current password instead (see account.ts).
			freshAge: 0
		},
		plugins
	});
}

export type Auth = ReturnType<typeof createAuth>;
