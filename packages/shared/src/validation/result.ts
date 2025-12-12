/**
 * Result Pattern
 *
 * Type-safe error handling following functional programming patterns.
 * Use ok() for success, err() for failures. Pattern matches on success field.
 */

import { z } from 'zod';

// Schema for success result (parameterized by data schema)
export const ResultSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
	z.object({
		success: z.literal(true),
		value: dataSchema,
	});

// Schema for failure result
export const ResultFailureSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		context: z.record(z.string(), z.unknown()).optional(),
	}),
});

/**
 * Result type for type-safe error handling
 *
 * @typeParam T - The success value type
 * @typeParam E - The error code type (defaults to string)
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, 'DIVIDE_BY_ZERO'> {
 *   if (b === 0) return err('DIVIDE_BY_ZERO', 'Cannot divide by zero');
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.success) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error.code); // type-safe error code
 * }
 * ```
 */
export type Result<T, E extends string = string> =
	| { success: true; value: T }
	| { success: false; error: { code: E; message: string; context?: Record<string, unknown> } };

/**
 * Create a success result
 *
 * @param value - The success value
 * @returns A success Result containing the value
 */
export const ok = <T>(value: T): Result<T, never> => ({
	success: true,
	value,
});

/**
 * Create a failure result
 *
 * @param code - The error code (used for type-safe error handling)
 * @param message - Human-readable error message
 * @param context - Optional context data for debugging
 * @returns A failure Result containing the error
 */
export const err = <E extends string>(
	code: E,
	message: string,
	context?: Record<string, unknown>
): Result<never, E> => ({
	success: false,
	error: { code, message, context },
});

/**
 * Check if a result is successful
 */
export function isOk<T, E extends string>(result: Result<T, E>): result is { success: true; value: T } {
	return result.success;
}

/**
 * Check if a result is a failure
 */
export function isErr<T, E extends string>(
	result: Result<T, E>
): result is { success: false; error: { code: E; message: string; context?: Record<string, unknown> } } {
	return !result.success;
}

/**
 * Unwrap a result or throw if it's an error
 *
 * @throws Error if result is a failure
 */
export function unwrap<T, E extends string>(result: Result<T, E>): T {
	if (result.success) return result.value;
	throw new Error(`Result error [${result.error.code}]: ${result.error.message}`);
}

/**
 * Unwrap a result or return a default value
 */
export function unwrapOr<T, E extends string>(result: Result<T, E>, defaultValue: T): T {
	return result.success ? result.value : defaultValue;
}

/**
 * Map over a successful result
 */
export function map<T, U, E extends string>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.success) return ok(fn(result.value));
	return result;
}

/**
 * Chain Results (flatMap)
 */
export function andThen<T, U, E extends string, F extends string>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, F>
): Result<U, E | F> {
	if (result.success) return fn(result.value);
	return result;
}
