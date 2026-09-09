import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Creates a Drizzle database handle. Kept free of SvelteKit imports so that
 * CLI scripts (account creation, seeding) and tests can reuse it.
 */
export function createDb(url: string) {
	const client = postgres(url, { max: 10, onnotice: () => {} });
	const db = drizzle(client, { schema });
	return { db, client };
}

export type Db = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either the shared handle or a transaction: feature modules accept both. */
export type DbClient = Db | Tx;
