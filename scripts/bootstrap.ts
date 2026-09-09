/**
 * Runs before the server starts in the Docker image (see Dockerfile / compose.prod.yaml):
 *
 *   1. waits for PostgreSQL,
 *   2. applies the committed Drizzle migrations,
 *   3. makes sure the administrator from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD exists.
 *
 * The admin account is created once. On later starts an existing account with
 * that email only has its admin role confirmed; its password is never touched,
 * so changing it in Settings sticks. Use `node build/create-user.js --reset-password`
 * inside the container if it is lost.
 */
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { createAuth, MIN_PASSWORD_LENGTH } from '../src/lib/server/auth/create';
import { users } from '../src/lib/server/db/schema';
import { connect, requireEnv } from './_env';

const email = requireEnv('ADMIN_EMAIL').trim().toLowerCase();
const name = requireEnv('ADMIN_NAME').trim();
const password = requireEnv('ADMIN_PASSWORD');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
	console.error(`ADMIN_EMAIL "${email}" is not a valid email address.`);
	process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
	console.error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	process.exit(1);
}

const { db, client } = connect();
const auth = createAuth({
	db,
	secret: requireEnv('BETTER_AUTH_SECRET'),
	baseURL: process.env.ORIGIN || `http://localhost:${process.env.PORT || 3000}`,
	allowSignUp: true
});

async function waitForDatabase(attempts = 30) {
	for (let i = 1; ; i++) {
		try {
			await client`select 1`;
			return;
		} catch (e) {
			if (i >= attempts) throw e;
			if (i === 1) console.log('Waiting for the database…');
			await new Promise((r) => setTimeout(r, 1000));
		}
	}
}

try {
	await waitForDatabase();
	await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
	console.log('Migrations applied.');

	const [existing] = await db.select().from(users).where(eq(users.email, email));
	if (existing) {
		if (existing.role !== 'admin') {
			await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
			console.log(`Promoted ${email} to administrator.`);
		} else {
			console.log(`Administrator ${email} already exists; password left unchanged.`);
		}
	} else {
		const { user } = await auth.api.signUpEmail({ body: { email, password, name } });
		await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
		console.log(`Created administrator ${email} (${name}).`);
	}
} finally {
	await client.end();
}
