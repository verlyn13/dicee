/**
 * Batch Processing Module
 *
 * Provides scalable game simulation with progress tracking and resume support.
 *
 * Primary API:
 * - runBatchSingleThreaded: Simple, reliable single-thread runner
 * - benchmark: Measure throughput
 *
 * For large-scale simulations:
 * - Use NDJSON output for atomic checkpoints
 * - Enable resume for interrupted runs
 * - Batch sessions of 100-200 games for manageable runs
 *
 * @example
 * // Simple in-memory batch
 * const result = await runBatchSingleThreaded({
 *   gameCount: 100,
 *   simulationConfig: { players: [{ id: 'p1', profileId: 'test' }] },
 *   seed: 42,
 * });
 *
 * @example
 * // Streaming to disk with resume
 * const result = await runBatchSingleThreaded({
 *   gameCount: 10000,
 *   simulationConfig: { players: [{ id: 'p1', profileId: 'professor' }] },
 *   seed: 42,
 *   outputDir: './results',
 *   resume: true,
 *   onProgress: (p) => console.log(`${p.completedGames}/${p.totalGames}`),
 * });
 */

// Types
export type {
	BatchRunConfig,
	ResolvedBatchRunConfig,
	BatchRunProgress,
	BatchResult,
	ProgressCallback,
	WorkerStats,
	WorkerMessage,
	InitMessage,
	RunBatchMessage,
	BatchCompleteMessage,
	ProgressMessage,
	ErrorMessage,
	ShutdownMessage,
} from './types.js';

// Single-threaded runner (recommended for most use cases)
export {
	runBatchSingleThreaded,
	benchmark,
	type SingleThreadedBatchOptions,
} from './single-threaded.js';

// NDJSON streaming I/O
export {
	NdjsonWriter,
	NdjsonReader,
	SimulationOutputWriter,
	getProcessedGameCount,
	getProcessedSeeds,
} from './ndjson-writer.js';

// Worker pool (experimental - for multi-core scaling)
export { WorkerPool, getRecommendedWorkerCount } from './worker-pool.js';

// Batch coordinator (experimental)
export { BatchCoordinator, runBatch } from './coordinator.js';
