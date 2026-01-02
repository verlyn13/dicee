/**
 * Timeout utility for async operations
 *
 * Provides a way to add timeout behavior to promises,
 * particularly useful for AI brain decisions that may hang.
 */

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
	readonly operation: string;
	readonly timeoutMs: number;

	constructor(operation: string, timeoutMs: number) {
		super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
		this.name = 'TimeoutError';
		this.operation = operation;
		this.timeoutMs = timeoutMs;
	}
}

/**
 * Wrap a promise with a timeout
 *
 * If the promise doesn't resolve within the specified time,
 * a TimeoutError is thrown.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Name of the operation (for error messages)
 * @returns The result of the promise if it resolves in time
 * @throws TimeoutError if the timeout expires
 *
 * @example
 * ```typescript
 * try {
 *   const result = await withTimeout(
 *     brain.decide(context),
 *     8000,
 *     'brain.decide'
 *   );
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     // Handle timeout - use fallback
 *   }
 *   throw error;
 * }
 * ```
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	operation: string,
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timeoutId = setTimeout(() => {
			reject(new TimeoutError(operation, timeoutMs));
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([promise, timeoutPromise]);
		return result;
	} finally {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
	}
}
