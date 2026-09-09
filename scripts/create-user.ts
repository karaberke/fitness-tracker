/**
 * Creates (or resets the password of) an account. Public sign-up is disabled in
 * the app, so this is the only way to provision users.
 *
 *   pnpm user:create --email you@example.com --name "Your Name"
 *   pnpm user:create --email you@example.com --name "Your Name" --admin
 *   pnpm user:create --email you@example.com --reset-password
 *   pnpm user:create --email you@example.com --admin        # promote an existing account
 *
 * Admins can create and remove other accounts from the Settings page.
 * The password is prompted for (hidden). For non-interactive use set USER_PASSWORD.
 */
import { eq } from 'drizzle-orm';
import { createAuth, MIN_PASSWORD_LENGTH } from '../src/lib/server/auth/create';
import { users } from '../src/lib/server/db/schema';
import { connect, parseArgs, promptSecret, requireEnv } from './_env';

const args = parseArgs(process.argv.slice(2));
const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
const name = typeof args.name === 'string' ? args.name.trim() : '';
const reset = args['reset-password'] === true;
const admin = args.admin === true;

if (!email || (!reset && !admin && !name)) {
	console.error(
		'Usage:\n  pnpm user:create --email you@example.com --name "Your Name" [--admin]\n  pnpm user:create --email you@example.com --reset-password\n  pnpm user:create --email you@example.com --admin'
	);
	process.exit(1);
}

const { db, client } = connect();
const auth = createAuth({
	db,
	secret: requireEnv('BETTER_AUTH_SECRET'),
	baseURL: process.env.ORIGIN || 'http://localhost:3000',
	allowSignUp: true
});

try {
	const [existing] = await db.select().from(users).where(eq(users.email, email));
	if (existing && !reset) {
		if (admin) {
			await db
				.update(users)
				.set({ role: 'admin', updatedAt: new Date() })
				.where(eq(users.id, existing.id));
			console.log(`${email} is now an administrator.`);
			process.exit(0);
		}
		console.error(
			`An account for ${email} already exists. Use --reset-password to change its password or --admin to promote it.`
		);
		process.exit(1);
	}
	if (!existing && (reset || !name)) {
		console.error(`No account for ${email}. Pass --name to create it.`);
		process.exit(1);
	}

	const password = process.env.USER_PASSWORD ?? (await promptSecret('Password: '));
	if (password.length < MIN_PASSWORD_LENGTH) {
		console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
		process.exit(1);
	}
	if (!process.env.USER_PASSWORD) {
		const again = await promptSecret('Repeat password: ');
		if (again !== password) {
			console.error('Passwords do not match.');
			process.exit(1);
		}
	}

	if (existing) {
		const ctx = await auth.$context;
		await ctx.internalAdapter.updatePassword(existing.id, await ctx.password.hash(password));
		await ctx.internalAdapter.deleteUserSessions(existing.id);
		console.log(`Password updated for ${email}. Existing sessions were signed out.`);
	} else {
		const { user } = await auth.api.signUpEmail({ body: { email, password, name } });
		if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
		console.log(`Created ${admin ? 'administrator' : 'account'} ${email} (${name}).`);
	}
} finally {
	await client.end();
}
