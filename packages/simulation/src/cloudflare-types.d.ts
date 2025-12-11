/**
 * Cloudflare Types Stub
 *
 * Provides type declarations for Cloudflare-specific types
 * that are referenced by @dicee/cloudflare-do but not available
 * in the simulation package's environment.
 */

declare interface DurableObjectState<Props = unknown> {
	readonly id: DurableObjectId;
	readonly storage: DurableObjectStorage;
	blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
	waitUntil(promise: Promise<unknown>): void;
}

declare interface DurableObjectId {
	readonly name?: string;
	toString(): string;
	equals(other: DurableObjectId): boolean;
}

declare interface DurableObjectStorage {
	get<T = unknown>(key: string): Promise<T | undefined>;
	get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
	put<T>(key: string, value: T): Promise<void>;
	put<T>(entries: Record<string, T>): Promise<void>;
	delete(key: string): Promise<boolean>;
	delete(keys: string[]): Promise<number>;
	deleteAll(): Promise<void>;
	list<T = unknown>(options?: { prefix?: string; limit?: number }): Promise<Map<string, T>>;
	setAlarm(scheduledTime: number | Date): Promise<void>;
	deleteAlarm(): Promise<void>;
	getAlarm(): Promise<number | null>;
}
