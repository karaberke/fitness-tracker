import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createDb } from './client';

// SvelteKit imports server modules while building (route analysis) with no
// environment; postgres.js only connects on the first query, so a placeholder
// URL is harmless there and the real check happens at startup.
if (!env.DATABASE_URL && !building) throw new Error('DATABASE_URL is not set');

const { db, client } = createDb(env.DATABASE_URL || 'postgres://build-placeholder/unused');

export { db, client };
export * as schema from './schema';
export type { Db, DbClient, Tx } from './client';
