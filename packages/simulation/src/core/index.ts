/**
 * Core Simulation Engine
 *
 * Provides deterministic game simulation with seeded random number generation.
 *
 * @example
 * import { SeededRandom, GameSimulator, runSingleGame } from '@dicee/simulation';
 *
 * const rng = new SeededRandom(42);
 * const result = await runSingleGame({
 *   players: [{ id: 'p1', profileId: 'professor' }],
 *   seed: 42,
 * });
 */

// Seeded random number generation
export {
	SeededRandom,
	createRandom,
	type RandomSource,
} from './seeded-random.js';

// Deterministic dice generation
export {
	rollDie,
	rollDice,
	rerollDice,
	executeTurnRolls,
	countDice,
	sortDice,
	hasNOfAKind,
	hasSmallStraight,
	hasLargeStraight,
	hasFullHouse,
	isDicee,
	sumDice,
	sumMatching,
	indicesToMask,
	maskToIndices,
	KEEP_ALL,
	KEEP_NONE,
	type TurnRolls,
} from './seeded-dice.js';

// Brain RNG adapter
export {
	MathRandomOverride,
	BrainRngAdapter,
	createAdaptedBrain,
	withDeterministicRandom,
	withDeterministicRandomAsync,
	type SimulationBrain,
	type SimulationProfile,
	type SimulationTraits,
	type SimulationTiming,
	type SimulationContext,
	type SimulationDecision,
} from './brain-adapter.js';

// Game simulator
export {
	GameSimulator,
	runSingleGame,
	type GameSimulatorConfig,
} from './game-simulator.js';
