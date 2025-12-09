/**
 * AI Brain Module
 *
 * Exports all brain implementations and factory functions.
 */

// Types
export type { AIBrain, BrainOptions, CategoryEV, KeepAnalysis } from './types';

// Factory
export {
	createBrain,
	registerBrain,
	initializeBrainFactory,
	checkWasmAvailability,
	getAvailableBrainTypes,
	isBrainTypeAvailable,
	isWasmEnabled,
} from './factory';

// Brain implementations
export { OptimalBrain } from './optimal';
export { ProbabilisticBrain } from './probabilistic';
export { PersonalityBrain } from './personality';
export { RandomBrain } from './random';
