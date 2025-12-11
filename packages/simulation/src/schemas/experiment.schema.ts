/**
 * Experiment and Hypothesis Schemas
 *
 * Scientific experiment definitions for AI calibration and analysis.
 * Supports hypothesis testing, adaptive stopping rules, and statistical rigor.
 *
 * @example
 * import { ExperimentDefinitionSchema, HypothesisSchema } from '@dicee/simulation/schemas';
 *
 * const experiment = ExperimentDefinitionSchema.parse({
 *   id: 'calibration_v1',
 *   type: 'CALIBRATION',
 *   hypotheses: [...],
 *   ...
 * });
 */

import { z } from 'zod';
import { MetricIdSchema, ProfileIdSchema } from './simulation.schema.js';

// =============================================================================
// Hypothesis Schemas
// =============================================================================

/**
 * Direction of hypothesis test
 */
export const HypothesisDirectionSchema = z.enum([
	'greater_than',
	'less_than',
	'not_equal',
	'within_range',
]);

/**
 * Statistical test to use for hypothesis
 */
export const StatisticalTestSchema = z.enum([
	't_test_one_sample',
	't_test_two_sample',
	'welch_t_test',
	'mann_whitney_u',
	'chi_square',
	'anova',
]);

/**
 * Target value for hypothesis - either a single value or a range
 */
export const HypothesisTargetSchema = z.union([
	z.number(),
	z.object({
		low: z.number(),
		high: z.number(),
	}),
]);

/**
 * Single hypothesis definition
 */
export const HypothesisSchema = z.object({
	/** Hypothesis ID (H1, H2, etc.) */
	id: z.string().regex(/^H\d+$/, { error: 'Hypothesis ID must be H1, H2, etc.' }),

	/** Null hypothesis statement */
	nullHypothesis: z.string().min(10),

	/** Alternative hypothesis statement */
	alternativeHypothesis: z.string().min(10),

	/** Metric being tested */
	metric: MetricIdSchema,

	/** Profile ID if testing a specific profile */
	profileId: ProfileIdSchema.optional(),

	/** Direction of the test */
	direction: HypothesisDirectionSchema,

	/** Target value or range */
	target: HypothesisTargetSchema,

	/** Statistical test to use */
	test: StatisticalTestSchema,

	/** Significance level (default 0.05) */
	alpha: z.number().min(0.001).max(0.2).default(0.05),

	/** Minimum effect size to detect (Cohen's d, default 0.5) */
	minEffectSize: z.number().min(0.1).max(2.0).default(0.5),

	/** Statistical power (default 0.80) */
	power: z.number().min(0.7).max(0.99).default(0.8),
});

// =============================================================================
// Stopping Rule Schemas
// =============================================================================

/**
 * Fixed stopping rule - run exactly N games per unit
 */
export const FixedStoppingRuleSchema = z.object({
	type: z.literal('FIXED'),
	/** Games per experimental unit (profile or matchup) */
	gamesPerUnit: z.number().int().min(10).max(100_000),
});

/**
 * Sequential stopping rule - stop early if significance reached
 */
export const SequentialStoppingRuleSchema = z.object({
	type: z.literal('SEQUENTIAL'),
	/** Minimum games before checking for early stop */
	minGames: z.number().int().min(30).default(50),
	/** Maximum games if significance not reached */
	maxGames: z.number().int().max(100_000).default(10_000),
	/** Check for significance every N games */
	checkEveryN: z.number().int().min(5).default(50),
	/** P-value threshold for futility stop (too low to ever reject) */
	futilityPValue: z.number().min(0.001).max(0.1).default(0.001),
});

/**
 * Adaptive stopping rule - stop when CI width target reached
 */
export const AdaptiveStoppingRuleSchema = z.object({
	type: z.literal('ADAPTIVE'),
	/** Target 95% CI width in points */
	targetCIWidth: z.number().min(1).max(50),
	/** Maximum games if CI target not reached */
	maxGames: z.number().int().max(100_000).default(5_000),
	/** Minimum games before adaptive stopping */
	minGames: z.number().int().min(30).default(100),
});

/**
 * Discriminated union of stopping rules
 */
export const StoppingRuleSchema = z.discriminatedUnion('type', [
	FixedStoppingRuleSchema,
	SequentialStoppingRuleSchema,
	AdaptiveStoppingRuleSchema,
]);

// =============================================================================
// Experiment Definition Schemas
// =============================================================================

/**
 * Experiment type determines the structure and analysis approach
 */
export const ExperimentTypeSchema = z.enum([
	'CALIBRATION',
	'DECISION_QUALITY',
	'HEAD_TO_HEAD',
	'TRAIT_SENSITIVITY',
	'REGRESSION',
	'ABLATION',
]);

/**
 * Complete experiment definition
 */
export const ExperimentDefinitionSchema = z.object({
	/** Unique experiment identifier (snake_case, 3-50 chars) */
	id: z
		.string()
		.regex(/^[a-z][a-z0-9_]*$/, { error: 'ID must be snake_case' })
		.min(3)
		.max(50),

	/** Semantic version of this experiment definition */
	version: z
		.string()
		.regex(/^\d+\.\d+\.\d+$/, { error: 'Must be semver (e.g., 1.0.0)' })
		.default('1.0.0'),

	/** Human-readable title */
	title: z.string().min(5).max(200),

	/** Detailed description of experiment purpose */
	description: z.string().min(20),

	/** Experiment type */
	type: ExperimentTypeSchema,

	/** ISO timestamp when experiment was created */
	createdAt: z.string().datetime(),

	/** Author identifier */
	author: z.string().optional(),

	/** Tags for categorization */
	tags: z.array(z.string()).default([]),

	/** Hypotheses to test */
	hypotheses: z.array(HypothesisSchema).min(1),

	/** Profile IDs to include in experiment */
	profileIds: z.array(ProfileIdSchema).min(1),

	/** Stopping rule for the experiment */
	stoppingRule: StoppingRuleSchema,

	/** Metrics to collect and report */
	metrics: z.array(MetricIdSchema).min(1),

	/** Master seed for reproducibility (optional - random if not provided) */
	masterSeed: z.number().int().optional(),

	/** Number of players per game (default: 1 for solo calibration) */
	playersPerGame: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1),
});

// =============================================================================
// Experiment Result Schemas
// =============================================================================

/**
 * Descriptive statistics for a metric
 */
export const DescriptiveStatsSchema = z.object({
	/** Sample size */
	n: z.number().int().min(0),
	/** Mean value */
	mean: z.number(),
	/** Median value */
	median: z.number(),
	/** Standard deviation */
	stdDev: z.number().min(0),
	/** Minimum value */
	min: z.number(),
	/** Maximum value */
	max: z.number(),
	/** First quartile (25th percentile) */
	q1: z.number(),
	/** Third quartile (75th percentile) */
	q3: z.number(),
	/** 95% confidence interval lower bound */
	ci95Lower: z.number(),
	/** 95% confidence interval upper bound */
	ci95Upper: z.number(),
});

/**
 * Effect size interpretation
 */
export const EffectInterpretationSchema = z.enum([
	'negligible',
	'small',
	'medium',
	'large',
	'very_large',
]);

/**
 * Result of a hypothesis test
 */
export const HypothesisTestResultSchema = z.object({
	/** Reference to hypothesis ID */
	hypothesisId: z.string(),
	/** Whether null hypothesis was rejected */
	rejected: z.boolean(),
	/** P-value from statistical test */
	pValue: z.number().min(0).max(1),
	/** Test statistic value */
	testStatistic: z.number(),
	/** Effect size (Cohen's d or equivalent) */
	effectSize: z.number(),
	/** Human-readable effect interpretation */
	effectInterpretation: EffectInterpretationSchema,
	/** Sample size used */
	sampleSize: z.number().int().min(0),
	/** Human-readable conclusion */
	conclusion: z.string(),
});

/**
 * Complete experiment results
 */
export const ExperimentResultsSchema = z.object({
	/** Reference to experiment ID */
	experimentId: z.string(),
	/** Version of experiment definition used */
	experimentVersion: z.string(),
	/** ISO timestamp when experiment started */
	startedAt: z.string().datetime(),
	/** ISO timestamp when experiment completed */
	completedAt: z.string().datetime(),
	/** Total games simulated */
	totalGames: z.number().int().min(0),
	/** Total duration in milliseconds */
	durationMs: z.number().int().min(0),
	/** Master seed used */
	masterSeed: z.number().int().optional(),
	/** Results by profile ID -> metric ID -> stats */
	statsByProfile: z.record(z.string(), z.record(z.string(), DescriptiveStatsSchema)),
	/** Hypothesis test results */
	hypothesisResults: z.array(HypothesisTestResultSchema),
	/** Whether all hypotheses passed */
	allHypothesesPassed: z.boolean(),
	/** Summary text */
	summary: z.string(),
});

// =============================================================================
// Derived Types
// =============================================================================

/** Hypothesis direction */
export type HypothesisDirection = z.infer<typeof HypothesisDirectionSchema>;

/** Statistical test type */
export type StatisticalTest = z.infer<typeof StatisticalTestSchema>;

/** Hypothesis target (value or range) */
export type HypothesisTarget = z.infer<typeof HypothesisTargetSchema>;

/** Single hypothesis */
export type Hypothesis = z.infer<typeof HypothesisSchema>;

/** Fixed stopping rule */
export type FixedStoppingRule = z.infer<typeof FixedStoppingRuleSchema>;

/** Sequential stopping rule */
export type SequentialStoppingRule = z.infer<typeof SequentialStoppingRuleSchema>;

/** Adaptive stopping rule */
export type AdaptiveStoppingRule = z.infer<typeof AdaptiveStoppingRuleSchema>;

/** Any stopping rule */
export type StoppingRule = z.infer<typeof StoppingRuleSchema>;

/** Experiment type */
export type ExperimentType = z.infer<typeof ExperimentTypeSchema>;

/** Complete experiment definition */
export type ExperimentDefinition = z.infer<typeof ExperimentDefinitionSchema>;

/** Descriptive statistics */
export type DescriptiveStats = z.infer<typeof DescriptiveStatsSchema>;

/** Effect size interpretation */
export type EffectInterpretation = z.infer<typeof EffectInterpretationSchema>;

/** Hypothesis test result */
export type HypothesisTestResult = z.infer<typeof HypothesisTestResultSchema>;

/** Complete experiment results */
export type ExperimentResults = z.infer<typeof ExperimentResultsSchema>;
