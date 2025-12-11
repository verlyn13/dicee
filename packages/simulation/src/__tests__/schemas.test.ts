/**
 * Schema Validation Tests
 *
 * Validates TypeScript Zod schemas and generates fixtures for cross-language testing.
 */

import { describe, expect, it } from 'vitest';
import {
	BatchConfigSchema,
	DecisionResultSchema,
	type ExperimentDefinition,
	ExperimentDefinitionSchema,
	type GameResult,
	GameResultSchema,
	HypothesisSchema,
	isExperimentDefinition,
	isGameResult,
	parseGameResult,
	// Validators
	parseSimulationConfig,
	// Types
	type SimulationConfig,
	// Schemas
	SimulationConfigSchema,
	StoppingRuleSchema,
	TurnResultSchema,
} from '../schemas/index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const validSimulationConfig: SimulationConfig = {
	players: [
		{
			id: 'player-1',
			profileId: 'professor',
			brainOverride: 'optimal',
		},
		{
			id: 'player-2',
			profileId: 'carmen',
		},
	],
	seed: 42,
	captureDecisions: true,
	captureIntermediateStates: false,
};

const validGameResult: GameResult = {
	gameId: '550e8400-e29b-41d4-a716-446655440000',
	seed: 42,
	experimentId: 'calibration_v1',
	startedAt: '2024-12-10T10:00:00.000Z',
	completedAt: '2024-12-10T10:00:05.123Z',
	durationMs: 5123,
	players: [
		{
			id: 'player-1',
			profileId: 'professor',
			finalScore: 312,
			scorecard: {
				ones: 3,
				twos: 6,
				threes: 9,
				fours: 12,
				fives: 15,
				sixes: 18,
				threeOfAKind: 25,
				fourOfAKind: 28,
				fullHouse: 25,
				smallStraight: 30,
				largeStraight: 40,
				dicee: 50,
				chance: 23,
				diceeBonus: 0,
				upperBonus: 35,
			},
			upperBonus: true,
			diceeCount: 1,
			optimalDecisions: 35,
			totalDecisions: 39,
			evLoss: 4.2,
		},
	],
	winnerId: 'player-1',
	winnerProfileId: 'professor',
};

const validExperimentDefinition: ExperimentDefinition = {
	id: 'calibration_v1',
	version: '1.0.0',
	title: 'AI Profile Calibration Experiment',
	description: 'Calibrate AI profiles to target score distributions for balanced gameplay',
	type: 'CALIBRATION',
	createdAt: '2024-12-10T10:00:00.000Z',
	author: 'test',
	tags: ['calibration', 'ai', 'profiles'],
	hypotheses: [
		{
			id: 'H1',
			nullHypothesis: 'Professor AI average score equals 310 points',
			alternativeHypothesis: 'Professor AI average score differs from 310 points',
			metric: 'total_score',
			profileId: 'professor',
			direction: 'within_range',
			target: { low: 305, high: 315 },
			test: 't_test_one_sample',
			alpha: 0.05,
			minEffectSize: 0.5,
			power: 0.8,
		},
	],
	profileIds: ['professor', 'carmen', 'riley'],
	stoppingRule: {
		type: 'ADAPTIVE',
		targetCIWidth: 5,
		maxGames: 5000,
		minGames: 100,
	},
	metrics: ['total_score', 'upper_bonus_rate', 'dicee_rate'],
	masterSeed: 12345,
	playersPerGame: 1,
};

// =============================================================================
// Simulation Config Tests
// =============================================================================

describe('SimulationConfigSchema', () => {
	it('validates a correct simulation config', () => {
		const result = SimulationConfigSchema.safeParse(validSimulationConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.players).toHaveLength(2);
			expect(result.data.seed).toBe(42);
		}
	});

	it('rejects config with too many players', () => {
		const invalid = {
			...validSimulationConfig,
			players: [
				{ id: 'p1', profileId: 'riley' },
				{ id: 'p2', profileId: 'carmen' },
				{ id: 'p3', profileId: 'liam' },
				{ id: 'p4', profileId: 'professor' },
				{ id: 'p5', profileId: 'charlie' },
			],
		};
		const result = SimulationConfigSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it('rejects config with invalid profile ID', () => {
		const invalid = {
			...validSimulationConfig,
			players: [{ id: 'p1', profileId: 'invalid_profile' }],
		};
		const result = SimulationConfigSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it('parseSimulationConfig wrapper works', () => {
		const result = parseSimulationConfig(validSimulationConfig);
		expect(result.success).toBe(true);
	});
});

// =============================================================================
// Batch Config Tests
// =============================================================================

describe('BatchConfigSchema', () => {
	it('validates a correct batch config', () => {
		const config = {
			gameCount: 10000,
			workerCount: 12,
			baseSeed: 42,
			outputFormat: 'ndjson',
			outputPath: './results/games.ndjson',
			batchSize: 1000,
			progressIntervalMs: 500,
		};
		const result = BatchConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});

	it('applies defaults correctly', () => {
		const minimal = { gameCount: 100 };
		const result = BatchConfigSchema.safeParse(minimal);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.workerCount).toBe(12);
			expect(result.data.outputFormat).toBe('ndjson');
			expect(result.data.batchSize).toBe(10000);
		}
	});

	it('rejects game count over 1M', () => {
		const invalid = { gameCount: 2_000_000 };
		const result = BatchConfigSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Game Result Tests
// =============================================================================

describe('GameResultSchema', () => {
	it('validates a correct game result', () => {
		const result = GameResultSchema.safeParse(validGameResult);
		expect(result.success).toBe(true);
	});

	it('isGameResult type guard works', () => {
		expect(isGameResult(validGameResult)).toBe(true);
		expect(isGameResult({ invalid: true })).toBe(false);
	});

	it('parseGameResult wrapper works', () => {
		const result = parseGameResult(validGameResult);
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID for gameId', () => {
		const invalid = { ...validGameResult, gameId: 'not-a-uuid' };
		const result = GameResultSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Turn Result Tests
// =============================================================================

describe('TurnResultSchema', () => {
	it('validates a correct turn result', () => {
		const turn = {
			turnId: 'turn-001',
			gameId: '550e8400-e29b-41d4-a716-446655440000',
			playerId: 'player-1',
			profileId: 'professor',
			turnNumber: 7,
			rollCount: 2,
			finalDice: [3, 3, 3, 4, 5] as [number, number, number, number, number],
			scoredCategory: 'threes',
			scoredPoints: 9,
			optimalCategory: 'threes',
			optimalPoints: 9,
			evDifference: 0,
			wasOptimal: true,
		};
		const result = TurnResultSchema.safeParse(turn);
		expect(result.success).toBe(true);
	});

	it('rejects turn number out of range', () => {
		const invalid = {
			turnId: 'turn-001',
			gameId: '550e8400-e29b-41d4-a716-446655440000',
			playerId: 'player-1',
			profileId: 'professor',
			turnNumber: 14, // Invalid: max is 13
			rollCount: 1,
			finalDice: [1, 2, 3, 4, 5],
			scoredCategory: 'chance',
			scoredPoints: 15,
		};
		const result = TurnResultSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Decision Result Tests
// =============================================================================

describe('DecisionResultSchema', () => {
	it('validates a correct decision result', () => {
		const decision = {
			decisionId: 'dec-001',
			turnId: 'turn-001',
			gameId: '550e8400-e29b-41d4-a716-446655440000',
			playerId: 'player-1',
			rollNumber: 1,
			diceBefore: [1, 2, 3, 4, 5] as [number, number, number, number, number],
			diceAfter: [1, 2, 3, 6, 6] as [number, number, number, number, number],
			keptMask: [true, true, true, false, false] as [boolean, boolean, boolean, boolean, boolean],
			wasOptimalHold: true,
			evLoss: 0,
		};
		const result = DecisionResultSchema.safeParse(decision);
		expect(result.success).toBe(true);
	});
});

// =============================================================================
// Experiment Definition Tests
// =============================================================================

describe('ExperimentDefinitionSchema', () => {
	it('validates a correct experiment definition', () => {
		const result = ExperimentDefinitionSchema.safeParse(validExperimentDefinition);
		expect(result.success).toBe(true);
	});

	it('isExperimentDefinition type guard works', () => {
		expect(isExperimentDefinition(validExperimentDefinition)).toBe(true);
		expect(isExperimentDefinition({ invalid: true })).toBe(false);
	});

	it('rejects invalid experiment ID format', () => {
		const invalid = { ...validExperimentDefinition, id: 'Invalid-ID' };
		const result = ExperimentDefinitionSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it('rejects invalid hypothesis ID format', () => {
		const invalid = {
			...validExperimentDefinition,
			hypotheses: [{ ...validExperimentDefinition.hypotheses[0], id: 'not-H-format' }],
		};
		const result = ExperimentDefinitionSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Hypothesis Tests
// =============================================================================

describe('HypothesisSchema', () => {
	it('validates hypothesis with numeric target', () => {
		const hypothesis = {
			id: 'H2',
			nullHypothesis: 'Carmen AI average score equals 260 points',
			alternativeHypothesis: 'Carmen AI average score differs from 260 points',
			metric: 'total_score',
			profileId: 'carmen',
			direction: 'not_equal',
			target: 260,
			test: 't_test_one_sample',
		};
		const result = HypothesisSchema.safeParse(hypothesis);
		expect(result.success).toBe(true);
	});

	it('validates hypothesis with range target', () => {
		const hypothesis = {
			id: 'H3',
			nullHypothesis: 'Win rate is within expected range',
			alternativeHypothesis: 'Win rate is outside expected range',
			metric: 'win_rate',
			direction: 'within_range',
			target: { low: 0.45, high: 0.55 },
			test: 'chi_square',
		};
		const result = HypothesisSchema.safeParse(hypothesis);
		expect(result.success).toBe(true);
	});
});

// =============================================================================
// Stopping Rule Tests
// =============================================================================

describe('StoppingRuleSchema', () => {
	it('validates FIXED stopping rule', () => {
		const rule = { type: 'FIXED', gamesPerUnit: 1000 };
		const result = StoppingRuleSchema.safeParse(rule);
		expect(result.success).toBe(true);
	});

	it('validates SEQUENTIAL stopping rule', () => {
		const rule = {
			type: 'SEQUENTIAL',
			minGames: 100,
			maxGames: 10000,
			checkEveryN: 50,
			futilityPValue: 0.01,
		};
		const result = StoppingRuleSchema.safeParse(rule);
		expect(result.success).toBe(true);
	});

	it('validates ADAPTIVE stopping rule', () => {
		const rule = {
			type: 'ADAPTIVE',
			targetCIWidth: 5,
			maxGames: 5000,
			minGames: 100,
		};
		const result = StoppingRuleSchema.safeParse(rule);
		expect(result.success).toBe(true);
	});

	it('rejects invalid stopping rule type', () => {
		const invalid = { type: 'INVALID', foo: 'bar' };
		const result = StoppingRuleSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Cross-Language Fixture Export
// =============================================================================

/**
 * These fixtures can be exported to JSON for Python validation tests.
 * Run with: pnpm vitest run --reporter=verbose
 */
export const testFixtures = {
	simulationConfig: validSimulationConfig,
	gameResult: validGameResult,
	experimentDefinition: validExperimentDefinition,
};
