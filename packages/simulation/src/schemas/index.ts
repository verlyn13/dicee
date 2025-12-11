/**
 * @dicee/simulation/schemas
 *
 * Schema exports for AI simulation framework.
 * All schemas use Zod 4 for runtime validation.
 *
 * @example
 * // Import schemas
 * import { SimulationConfigSchema, GameResultSchema } from '@dicee/simulation/schemas';
 *
 * // Import types
 * import type { SimulationConfig, GameResult } from '@dicee/simulation/schemas';
 *
 * // Import validators
 * import { parseSimulationConfig, isGameResult } from '@dicee/simulation/schemas';
 */

// =============================================================================
// Simulation Configuration
// =============================================================================

export {
	type BatchConfig,
	BatchConfigSchema,
	type BrainType,
	BrainTypeSchema,
	type MetricId,
	MetricIdSchema,
	type OutputFormat,
	OutputFormatSchema,
	type PlayerConfig,
	PlayerConfigSchema,
	// Types
	type ProfileId,
	// Schemas
	ProfileIdSchema,
	type SimulationConfig,
	SimulationConfigSchema,
	type TraitOverrides,
	TraitOverridesSchema,
} from './simulation.schema.js';

// =============================================================================
// Results
// =============================================================================

export {
	type BatchProgress,
	BatchProgressSchema,
	type DecisionResult,
	DecisionResultSchema,
	type GameResult,
	GameResultSchema,
	// Types
	type PlayerResult,
	// Schemas
	PlayerResultSchema,
	type TurnResult,
	TurnResultSchema,
} from './results.schema.js';

// =============================================================================
// Experiments (Original)
// =============================================================================

export {
	type AdaptiveStoppingRule,
	AdaptiveStoppingRuleSchema,
	type DescriptiveStats,
	DescriptiveStatsSchema,
	type EffectInterpretation,
	EffectInterpretationSchema,
	type ExperimentDefinition,
	ExperimentDefinitionSchema,
	type ExperimentResults,
	ExperimentResultsSchema,
	type ExperimentType,
	ExperimentTypeSchema,
	type FixedStoppingRule,
	FixedStoppingRuleSchema,
	type Hypothesis,
	// Types
	type HypothesisDirection,
	// Schemas
	HypothesisDirectionSchema,
	HypothesisSchema,
	type HypothesisTarget,
	HypothesisTargetSchema,
	type HypothesisTestResult,
	HypothesisTestResultSchema,
	type SequentialStoppingRule,
	SequentialStoppingRuleSchema,
	type StatisticalTest,
	StatisticalTestSchema,
	type StoppingRule,
	StoppingRuleSchema,
} from './experiment.schema.js';

// =============================================================================
// Experiment Design (Multifactor Analysis Framework)
// =============================================================================

export {
	// Factor schemas
	StrategyTypeSchema,
	type StrategyType,
	PersonalityProfileSchema,
	type PersonalityProfile,
	MatchupTypeSchema,
	type MatchupType,
	GamePhaseSchema,
	type GamePhase,
	GranularitySchema,
	type Granularity,

	// Player and condition schemas
	ExperimentPlayerSchema,
	type ExperimentPlayer,
	ExperimentConditionSchema,
	type ExperimentCondition,

	// Hypothesis schemas (extended)
	StatisticalTestSchema as DesignStatisticalTestSchema,
	type StatisticalTest as DesignStatisticalTest,
	HypothesisDirectionSchema as DesignHypothesisDirectionSchema,
	type HypothesisDirection as DesignHypothesisDirection,
	HypothesisSchema as DesignHypothesisSchema,
	type Hypothesis as DesignHypothesis,

	// Experiment definition (extended)
	ExperimentTypeSchema as DesignExperimentTypeSchema,
	type ExperimentType as DesignExperimentType,
	ExperimentStatusSchema,
	type ExperimentStatus,
	ExperimentLineageSchema,
	type ExperimentLineage,
	ExperimentDefinitionSchema as DesignExperimentDefinitionSchema,
	type ExperimentDefinition as DesignExperimentDefinition,

	// Registry schemas
	ExperimentResultSummarySchema,
	type ExperimentResultSummary,
	ExperimentRegistrySchema,
	type ExperimentRegistry,

	// Validators
	parseExperimentDefinition as parseDesignExperimentDefinition,
	parseExperimentRegistry,
	isValidExperiment,

	// Helpers
	calculateRequiredSampleSize,
	generateFactorialConditions,
} from './experiment-design.schema.js';

// =============================================================================
// Validators
// =============================================================================

export {
	isBatchConfig,
	isDecisionResult,
	isExperimentDefinition,
	isExperimentResults,
	isGameResult,
	isHypothesis,
	isHypothesisTestResult,
	isPlayerConfig,
	isPlayerResult,
	// Type guards
	isSimulationConfig,
	isStoppingRule,
	isTurnResult,
	isValidBrainType,
	// Enum validators
	isValidProfileId,
	parseBatchConfig,
	parseDecisionResult,
	// Experiment validators
	parseExperimentDefinition,
	parseExperimentResults,
	// Result validators
	parseGameResult,
	parseHypothesis,
	parseHypothesisTestResult,
	parsePlayerConfig,
	parsePlayerResult,
	// Configuration validators
	parseSimulationConfig,
	parseStoppingRule,
	parseTurnResult,
} from './validators.js';

// =============================================================================
// Re-export shared types for convenience
// =============================================================================

export type {
	Category,
	DiceArray,
	GameState,
	KeptMask,
	PlayerGameState,
	Scorecard,
} from '@dicee/shared';

export { CategorySchema, DiceArraySchema, KeptMaskSchema, ScorecardSchema } from '@dicee/shared';
