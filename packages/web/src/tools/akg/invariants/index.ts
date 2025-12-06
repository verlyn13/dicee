/**
 * AKG Invariants Module
 *
 * Provides invariant registration, execution, and built-in checks.
 */

// Import built-in definitions to register them
import './definitions/index.js';

export type { BuiltinInvariantId } from './definitions/index.js';
// Re-export built-in invariant info
export { BUILTIN_INVARIANTS } from './definitions/index.js';
export type { RegisteredInvariant } from './registry.js';
// Re-export registry
export {
	createInvariant,
	defineInvariant,
	getRegistry,
	registry,
} from './registry.js';
export type { RunnerOptions } from './runner.js';
// Re-export runner
export {
	formatSummary,
	runInvariant,
	runInvariants,
	validateGraph,
} from './runner.js';
