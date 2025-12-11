/**
 * Validation Helpers
 *
 * Type-safe validators and type guards for simulation schemas.
 * Uses safeParse pattern for non-throwing validation.
 *
 * @example
 * import { parseSimulationConfig, isGameResult } from '@dicee/simulation/schemas';
 *
 * const result = parseSimulationConfig(rawConfig);
 * if (result.success) {
 *   // result.data is typed as SimulationConfig
 * }
 *
 * if (isGameResult(data)) {
 *   // data is typed as GameResult
 * }
 */

import type {
	ExperimentDefinition,
	ExperimentResults,
	Hypothesis,
	HypothesisTestResult,
	StoppingRule,
} from './experiment.schema.js';
import {
	ExperimentDefinitionSchema,
	ExperimentResultsSchema,
	HypothesisSchema,
	HypothesisTestResultSchema,
	StoppingRuleSchema,
} from './experiment.schema.js';
import type { DecisionResult, GameResult, PlayerResult, TurnResult } from './results.schema.js';
import {
	DecisionResultSchema,
	GameResultSchema,
	PlayerResultSchema,
	TurnResultSchema,
} from './results.schema.js';
import type { BatchConfig, PlayerConfig, SimulationConfig } from './simulation.schema.js';
import {
	BatchConfigSchema,
	BrainTypeSchema,
	PlayerConfigSchema,
	ProfileIdSchema,
	SimulationConfigSchema,
} from './simulation.schema.js';

// =============================================================================
// Configuration Validators
// =============================================================================

/**
 * Parse and validate simulation configuration
 */
export function parseSimulationConfig(input: unknown) {
	return SimulationConfigSchema.safeParse(input);
}

/**
 * Parse and validate batch configuration
 */
export function parseBatchConfig(input: unknown) {
	return BatchConfigSchema.safeParse(input);
}

/**
 * Parse and validate player configuration
 */
export function parsePlayerConfig(input: unknown) {
	return PlayerConfigSchema.safeParse(input);
}

// =============================================================================
// Result Validators
// =============================================================================

/**
 * Parse and validate game result
 */
export function parseGameResult(input: unknown) {
	return GameResultSchema.safeParse(input);
}

/**
 * Parse and validate turn result
 */
export function parseTurnResult(input: unknown) {
	return TurnResultSchema.safeParse(input);
}

/**
 * Parse and validate decision result
 */
export function parseDecisionResult(input: unknown) {
	return DecisionResultSchema.safeParse(input);
}

/**
 * Parse and validate player result
 */
export function parsePlayerResult(input: unknown) {
	return PlayerResultSchema.safeParse(input);
}

// =============================================================================
// Experiment Validators
// =============================================================================

/**
 * Parse and validate experiment definition
 */
export function parseExperimentDefinition(input: unknown) {
	return ExperimentDefinitionSchema.safeParse(input);
}

/**
 * Parse and validate hypothesis
 */
export function parseHypothesis(input: unknown) {
	return HypothesisSchema.safeParse(input);
}

/**
 * Parse and validate stopping rule
 */
export function parseStoppingRule(input: unknown) {
	return StoppingRuleSchema.safeParse(input);
}

/**
 * Parse and validate experiment results
 */
export function parseExperimentResults(input: unknown) {
	return ExperimentResultsSchema.safeParse(input);
}

/**
 * Parse and validate hypothesis test result
 */
export function parseHypothesisTestResult(input: unknown) {
	return HypothesisTestResultSchema.safeParse(input);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if input is a valid SimulationConfig
 */
export function isSimulationConfig(input: unknown): input is SimulationConfig {
	return SimulationConfigSchema.safeParse(input).success;
}

/**
 * Check if input is a valid BatchConfig
 */
export function isBatchConfig(input: unknown): input is BatchConfig {
	return BatchConfigSchema.safeParse(input).success;
}

/**
 * Check if input is a valid PlayerConfig
 */
export function isPlayerConfig(input: unknown): input is PlayerConfig {
	return PlayerConfigSchema.safeParse(input).success;
}

/**
 * Check if input is a valid GameResult
 */
export function isGameResult(input: unknown): input is GameResult {
	return GameResultSchema.safeParse(input).success;
}

/**
 * Check if input is a valid TurnResult
 */
export function isTurnResult(input: unknown): input is TurnResult {
	return TurnResultSchema.safeParse(input).success;
}

/**
 * Check if input is a valid DecisionResult
 */
export function isDecisionResult(input: unknown): input is DecisionResult {
	return DecisionResultSchema.safeParse(input).success;
}

/**
 * Check if input is a valid PlayerResult
 */
export function isPlayerResult(input: unknown): input is PlayerResult {
	return PlayerResultSchema.safeParse(input).success;
}

/**
 * Check if input is a valid ExperimentDefinition
 */
export function isExperimentDefinition(input: unknown): input is ExperimentDefinition {
	return ExperimentDefinitionSchema.safeParse(input).success;
}

/**
 * Check if input is a valid Hypothesis
 */
export function isHypothesis(input: unknown): input is Hypothesis {
	return HypothesisSchema.safeParse(input).success;
}

/**
 * Check if input is a valid StoppingRule
 */
export function isStoppingRule(input: unknown): input is StoppingRule {
	return StoppingRuleSchema.safeParse(input).success;
}

/**
 * Check if input is a valid ExperimentResults
 */
export function isExperimentResults(input: unknown): input is ExperimentResults {
	return ExperimentResultsSchema.safeParse(input).success;
}

/**
 * Check if input is a valid HypothesisTestResult
 */
export function isHypothesisTestResult(input: unknown): input is HypothesisTestResult {
	return HypothesisTestResultSchema.safeParse(input).success;
}

// =============================================================================
// Enum Validators
// =============================================================================

/**
 * Check if string is a valid profile ID
 */
export function isValidProfileId(input: string): boolean {
	return ProfileIdSchema.safeParse(input).success;
}

/**
 * Check if string is a valid brain type
 */
export function isValidBrainType(input: string): boolean {
	return BrainTypeSchema.safeParse(input).success;
}
