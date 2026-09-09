import { ValidationError } from '../errors';

const pgCode = (e: unknown): string | undefined => {
	if (typeof e !== 'object' || e === null) return undefined;
	const err = e as { code?: unknown; cause?: unknown };
	if (typeof err.code === 'string') return err.code;
	// Drizzle wraps driver errors in DrizzleQueryError; the PostgreSQL error is the cause.
	return pgCode(err.cause);
};

/** True for a PostgreSQL unique-constraint violation (SQLSTATE 23505). */
export const isUniqueViolation = (e: unknown): boolean => pgCode(e) === '23505';

/** Re-throws a unique violation as a field-level validation error; passes other errors through. */
export function rethrowUnique(e: unknown, field: string, message: string): never {
	if (isUniqueViolation(e)) throw new ValidationError({ [field]: message });
	throw e;
}
