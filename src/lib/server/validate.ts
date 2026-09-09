import { ValidationError } from './errors';

/** Collects field errors so a form can show all problems at once. */
export class FieldErrors {
	readonly fields: Record<string, string> = {};

	add(field: string, message: string) {
		if (!this.fields[field]) this.fields[field] = message;
	}

	get any() {
		return Object.keys(this.fields).length > 0;
	}

	throwIfAny(): void {
		if (this.any) throw new ValidationError(this.fields);
	}
}

const asString = (v: unknown) => (v == null ? '' : String(v)).trim();

export function optionalText(
	v: unknown,
	errors: FieldErrors,
	field: string,
	max = 500
): string | null {
	const s = asString(v);
	if (s.length > max) errors.add(field, `Must be ${max} characters or fewer`);
	return s.length ? s : null;
}

export function requiredText(v: unknown, errors: FieldErrors, field: string, max = 200): string {
	const s = asString(v);
	if (!s) errors.add(field, 'Required');
	else if (s.length > max) errors.add(field, `Must be ${max} characters or fewer`);
	return s;
}

export function boolField(v: unknown): boolean {
	if (typeof v === 'boolean') return v;
	const s = asString(v).toLowerCase();
	return s === 'true' || s === 'on' || s === '1' || s === 'yes';
}

export function intField(
	v: unknown,
	errors: FieldErrors,
	field: string,
	{ min, max, optional = false }: { min?: number; max?: number; optional?: boolean } = {}
): number | null {
	const s = asString(v);
	if (!s) {
		if (!optional) errors.add(field, 'Required');
		return null;
	}
	const n = Number(s);
	if (!Number.isInteger(n)) {
		errors.add(field, 'Must be a whole number');
		return null;
	}
	if (min != null && n < min) errors.add(field, `Must be at least ${min}`);
	if (max != null && n > max) errors.add(field, `Must be at most ${max}`);
	return n;
}

export function numberField(
	v: unknown,
	errors: FieldErrors,
	field: string,
	{ min, max, optional = false }: { min?: number; max?: number; optional?: boolean } = {}
): number | null {
	const s = asString(v).replace(',', '.');
	if (!s) {
		if (!optional) errors.add(field, 'Required');
		return null;
	}
	const n = Number(s);
	if (!Number.isFinite(n)) {
		errors.add(field, 'Must be a number');
		return null;
	}
	if (min != null && n < min) errors.add(field, `Must be at least ${min}`);
	if (max != null && n > max) errors.add(field, `Must be at most ${max}`);
	return n;
}

export function idField(v: unknown, errors: FieldErrors, field: string, optional = false) {
	return intField(v, errors, field, { min: 1, optional });
}

export function oneOf<T extends string>(
	v: unknown,
	allowed: readonly T[],
	errors: FieldErrors,
	field: string,
	fallback?: T
): T {
	const s = asString(v);
	if (!s && fallback !== undefined) return fallback;
	if ((allowed as readonly string[]).includes(s)) return s as T;
	errors.add(field, `Must be one of: ${allowed.join(', ')}`);
	return fallback ?? allowed[0];
}

/** Parses a route param into a positive integer id, or returns null. */
export function parseId(param: string | undefined): number | null {
	if (!param || !/^\d+$/.test(param)) return null;
	const n = Number(param);
	return n >= 1 && Number.isSafeInteger(n) ? n : null;
}
