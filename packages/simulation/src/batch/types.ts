/**
 * Batch Processing Types
 *
 * Shared types for worker pool and batch coordination.
 */

import type { GameResult, SimulationConfig } from '../schemas/index.js';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for batch simulation runs (runtime version)
 * Note: Schema version is BatchConfigSchema in simulation.schema.ts
 */
export interface BatchRunConfig {
	/** Total number of games to simulate */
	gameCount: number;
	/** Number of worker threads (default: CPU cores - 1) */
	workerCount?: number;
	/** Base seed for deterministic runs (optional) */
	baseSeed?: number;
	/** Output format */
	outputFormat?: 'ndjson' | 'memory';
	/** Output path for NDJSON files */
	outputPath?: string;
	/** Games per batch sent to workers */
	batchSize?: number;
	/** Progress callback interval in ms */
	progressIntervalMs?: number;
}

/**
 * Resolved batch configuration with defaults applied
 */
export interface ResolvedBatchRunConfig {
	gameCount: number;
	workerCount: number;
	baseSeed: number;
	outputFormat: 'ndjson' | 'memory';
	outputPath: string | null;
	batchSize: number;
	progressIntervalMs: number;
}

// =============================================================================
// Worker Messages
// =============================================================================

/**
 * Message types for worker communication
 */
export type WorkerMessageType =
	| 'INIT'
	| 'RUN_BATCH'
	| 'BATCH_COMPLETE'
	| 'PROGRESS'
	| 'ERROR'
	| 'SHUTDOWN';

/**
 * Initialize worker with configuration
 */
export interface InitMessage {
	type: 'INIT';
	workerId: number;
	config: SimulationConfig;
}

/**
 * Request worker to run a batch of games
 */
export interface RunBatchMessage {
	type: 'RUN_BATCH';
	batchId: number;
	gameSeeds: number[];
}

/**
 * Worker completed a batch
 */
export interface BatchCompleteMessage {
	type: 'BATCH_COMPLETE';
	workerId: number;
	batchId: number;
	results: GameResult[];
	durationMs: number;
}

/**
 * Progress update from worker
 */
export interface ProgressMessage {
	type: 'PROGRESS';
	workerId: number;
	gamesCompleted: number;
	gamesTotal: number;
}

/**
 * Error from worker
 */
export interface ErrorMessage {
	type: 'ERROR';
	workerId: number;
	error: string;
	batchId?: number;
}

/**
 * Shutdown worker
 */
export interface ShutdownMessage {
	type: 'SHUTDOWN';
}

/**
 * Union of all worker messages
 */
export type WorkerMessage =
	| InitMessage
	| RunBatchMessage
	| BatchCompleteMessage
	| ProgressMessage
	| ErrorMessage
	| ShutdownMessage;

// =============================================================================
// Progress Tracking
// =============================================================================

/**
 * Batch run progress information
 */
export interface BatchRunProgress {
	/** Total games requested */
	totalGames: number;
	/** Games completed so far */
	completedGames: number;
	/** Games currently in progress */
	inProgressGames: number;
	/** Elapsed time in ms */
	elapsedMs: number;
	/** Estimated remaining time in ms */
	estimatedRemainingMs: number;
	/** Games per second */
	gamesPerSecond: number;
	/** Per-worker stats */
	workers: WorkerStats[];
}

/**
 * Statistics for a single worker
 */
export interface WorkerStats {
	workerId: number;
	gamesCompleted: number;
	batchesCompleted: number;
	averageBatchMs: number;
	status: 'idle' | 'working' | 'error';
}

// =============================================================================
// Results
// =============================================================================

/**
 * Complete batch run result
 */
export interface BatchResult {
	/** All game results (if outputFormat is 'memory') */
	results: GameResult[];
	/** Total games completed */
	totalGames: number;
	/** Total duration in ms */
	durationMs: number;
	/** Games per second achieved */
	gamesPerSecond: number;
	/** Base seed used */
	baseSeed: number;
	/** Number of workers used */
	workerCount: number;
	/** Output path (if NDJSON) */
	outputPath: string | null;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: BatchRunProgress) => void;
