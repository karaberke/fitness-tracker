import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv } from 'vite';
import { createDb } from '../lib/server/db/client';

/**
 * Runs once before the test suite: creates the throwaway test database (if
 * missing) inside the same Docker Postgres and applies the committed migrations.
 */
export default async function setup() {
	const env = loadEnv('test', process.cwd(), '');
	const url = env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL missing: check .env.test');
	const target = new URL(url);
	const dbName = target.pathname.slice(1);
	if (!dbName.endsWith('_test')) {
		throw new Error(
			`Refusing to run tests against "${dbName}": the database name must end in _test`
		);
	}

	const admin = new URL(url);
	admin.pathname = '/postgres';
	const adminSql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
	try {
		const exists = await adminSql`select 1 from pg_database where datname = ${dbName}`;
		if (exists.length === 0) await adminSql.unsafe(`create database "${dbName}"`);
	} finally {
		await adminSql.end();
	}

	const { db, client } = createDb(url);
	try {
		await migrate(db, { migrationsFolder: './drizzle' });
	} finally {
		await client.end();
	}
}
