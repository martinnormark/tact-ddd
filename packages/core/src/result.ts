// core/src/result.ts
import type { DomainError } from './errors';

export type Result<T, E = DomainError> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T> {
	return { ok: true as const, value };
}

export function err<E>(error: E): Result<never, E> {
	return { ok: false as const, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
	return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
	return !r.ok;
}
