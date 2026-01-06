/**
 * Persistence Queue (AlarmQueue Pattern)
 *
 * Reliable async persistence with retry using DO SQLite and alarms.
 * Tasks are durably stored and processed with exponential backoff.
 */

import type { GamePersistenceService } from './game-persistence.service';
import type { DomainEvent, PersistenceResult } from './schemas';

// ============================================================================
// Types
// ============================================================================

export const PERSISTENCE_TASK_TYPES = [
	'PERSIST_GAME_COMPLETION',
	'PERSIST_DOMAIN_EVENTS',
	'TRIGGER_AGGREGATION',
	'ABANDON_GAME',
] as const;

export type PersistenceTaskType = (typeof PERSISTENCE_TASK_TYPES)[number];

export interface PersistenceTask {
	type: PersistenceTaskType;
	gameId: string;
	payload: Record<string, unknown>;
	retryCount: number;
	createdAt: number;
	scheduledFor: number;
}

// ============================================================================
// Persistence Queue
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s for background tasks

export class PersistenceQueue {
	readonly #ctx: DurableObjectState;
	readonly #persistence: GamePersistenceService;
	readonly #onError: (task: PersistenceTask, error: string) => void;

	constructor(
		ctx: DurableObjectState,
		persistence: GamePersistenceService,
		onError: (task: PersistenceTask, error: string) => void,
	) {
		this.#ctx = ctx;
		this.#persistence = persistence;
		this.#onError = onError;
	}

	/**
	 * Schedule a persistence task with optional delay.
	 */
	async schedule(
		task: Omit<PersistenceTask, 'retryCount' | 'createdAt' | 'scheduledFor'>,
		delayMs = 0,
	): Promise<void> {
		const fullTask: PersistenceTask = {
			...task,
			retryCount: 0,
			createdAt: Date.now(),
			scheduledFor: Date.now() + delayMs,
		};

		// Store in DO SQLite for durability
		this.#ctx.storage.sql.exec(
			`INSERT INTO persistence_queue (task_type, game_id, payload, retry_count, created_at, scheduled_for)
       VALUES (?, ?, ?, ?, ?, ?)`,
			fullTask.type,
			fullTask.gameId,
			JSON.stringify(fullTask.payload),
			fullTask.retryCount,
			fullTask.createdAt,
			fullTask.scheduledFor,
		);

		// Set alarm if not already set or if this task is earlier
		const currentAlarm = await this.#ctx.storage.getAlarm();
		if (!currentAlarm || currentAlarm > fullTask.scheduledFor) {
			await this.#ctx.storage.setAlarm(fullTask.scheduledFor);
		}
	}

	/**
	 * Process due tasks. Called from DO alarm handler.
	 */
	async processDueTasks(): Promise<void> {
		const now = Date.now();

		// Get all due tasks
		const cursor = this.#ctx.storage.sql.exec(
			`SELECT rowid, * FROM persistence_queue WHERE scheduled_for <= ? ORDER BY scheduled_for ASC`,
			now,
		);

		const rows = [...cursor];

		for (const row of rows) {
			const task: PersistenceTask & { rowid: number } = {
				rowid: row.rowid as number,
				type: row.task_type as PersistenceTaskType,
				gameId: row.game_id as string,
				payload: JSON.parse(row.payload as string),
				retryCount: row.retry_count as number,
				createdAt: row.created_at as number,
				scheduledFor: row.scheduled_for as number,
			};

			const result = await this.#executeTask(task);

			if (result.success) {
				// Remove completed task
				this.#ctx.storage.sql.exec(`DELETE FROM persistence_queue WHERE rowid = ?`, task.rowid);
			} else if (result.retriable && task.retryCount < MAX_RETRIES) {
				// Schedule retry with exponential backoff
				const nextDelay = BASE_DELAY_MS * 2 ** task.retryCount;
				this.#ctx.storage.sql.exec(
					`UPDATE persistence_queue
           SET retry_count = ?, scheduled_for = ?
           WHERE rowid = ?`,
					task.retryCount + 1,
					now + nextDelay,
					task.rowid,
				);
			} else {
				// Max retries reached or non-retriable error
				this.#onError(task, result.error);
				this.#ctx.storage.sql.exec(`DELETE FROM persistence_queue WHERE rowid = ?`, task.rowid);
			}
		}

		// Schedule next alarm for remaining tasks
		const nextTaskCursor = this.#ctx.storage.sql.exec(
			`SELECT MIN(scheduled_for) as next FROM persistence_queue`,
		);
		const nextTaskRows = [...nextTaskCursor];
		if (nextTaskRows[0]?.next) {
			await this.#ctx.storage.setAlarm(nextTaskRows[0].next as number);
		}
	}

	async #executeTask(task: PersistenceTask): Promise<PersistenceResult> {
		switch (task.type) {
			case 'PERSIST_GAME_COMPLETION':
				return this.#persistence.completeGame(
					task.gameId,
					task.payload.winnerId as string | null,
					task.payload.rankings as Array<{
						playerId: string;
						rank: number;
						score: number;
						scorecard: Record<string, number>;
						isAi: boolean;
					}>,
					task.payload.durationMs as number,
				);

			case 'PERSIST_DOMAIN_EVENTS':
				return this.#persistence.persistDomainEvents(task.payload.events as DomainEvent[]);

			case 'TRIGGER_AGGREGATION':
				return this.#persistence.triggerAggregation(task.gameId, {
					skipRatings: task.payload.skipRatings as boolean,
					skipBadges: task.payload.skipBadges as boolean,
				});

			case 'ABANDON_GAME':
				return this.#persistence.abandonGame(task.gameId, task.payload.reason as string);

			default:
				return {
					success: false,
					error: `Unknown task type: ${task.type}`,
					retriable: false,
				};
		}
	}
}
