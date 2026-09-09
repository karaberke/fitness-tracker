import { sql } from 'drizzle-orm';
import { afterAll } from 'vitest';
import { client, db } from '$lib/server/db';
import { users, type User } from '$lib/server/db/schema';

/** Empties every application table (auth tables included) so each test starts clean. */
export async function resetDatabase() {
	await db.execute(
		sql`truncate table sets, workout_exercises, workouts, machine_settings, machines, exercises, sessions, accounts, verifications, users restart identity cascade`
	);
}

let counter = 0;
export async function createUser(name = 'User'): Promise<User> {
	counter += 1;
	const id = `user_${counter}_${Math.random().toString(36).slice(2, 8)}`;
	const [row] = await db
		.insert(users)
		.values({ id, name, email: `${id}@example.com` })
		.returning();
	return row;
}

export function closeDbAfterAll() {
	afterAll(async () => {
		await client.end();
	});
}
