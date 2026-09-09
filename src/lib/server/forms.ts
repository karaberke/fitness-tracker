import { error, fail } from '@sveltejs/kit';
import { NotFoundError, ValidationError } from './errors';

export type FieldErrorMap = Record<string, string>;

/** Turns a FormData into a plain object; repeated keys keep the last value. */
export async function formValues(request: Request): Promise<Record<string, string>> {
	const data = await request.formData();
	const out: Record<string, string> = {};
	for (const [k, v] of data) out[k] = typeof v === 'string' ? v : '';
	return out;
}

/**
 * Maps feature-module errors to SvelteKit responses. `extra` is merged into the
 * `fail` payload so the page can attach errors to the right form (intent, ids…).
 */
export function failFrom(e: unknown, extra: Record<string, unknown> = {}) {
	if (e instanceof ValidationError) return fail(400, { ...extra, errors: e.fields });
	if (e instanceof NotFoundError) error(404, e.message);
	throw e;
}

/** Keeps a `next` redirect target on the same origin. */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
	return value;
}

/** For load functions: 404 for missing/foreign records, rethrow anything else. */
export function orNotFound(e: unknown): never {
	if (e instanceof NotFoundError) error(404, e.message);
	throw e;
}
