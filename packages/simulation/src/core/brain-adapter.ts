/**
 * Brain RNG Adapter
 *
 * Wraps existing AI brains to use seeded RNG for deterministic simulations.
 * Temporarily overrides Math.random during brain decision-making.
 *
 * @example
 * const rng = new SeededRandom(42);
 * const adapter = new BrainRngAdapter(brain, rng);
 * const decision = await adapter.decide(context);
 */

import type { RandomSource } from './seeded-random.js';

/**
 * Context manager for temporarily overriding Math.random
 */
export class MathRandomOverride {
	private originalRandom: typeof Math.random;
	private isOverridden = false;

	constructor(private rng: RandomSource) {
		this.originalRandom = Math.random;
	}

	/**
	 * Start overriding Math.random
	 */
	start(): void {
		if (this.isOverridden) return;
		this.originalRandom = Math.random;
		Math.random = () => this.rng.random();
		this.isOverridden = true;
	}

	/**
	 * Stop overriding and restore original Math.random
	 */
	stop(): void {
		if (!this.isOverridden) return;
		Math.random = this.originalRandom;
		this.isOverridden = false;
	}

	/**
	 * Execute a function with Math.random overridden
	 */
	withOverride<T>(fn: () => T): T {
		this.start();
		try {
			return fn();
		} finally {
			this.stop();
		}
	}

	/**
	 * Execute an async function with Math.random overridden
	 */
	async withOverrideAsync<T>(fn: () => Promise<T>): Promise<T> {
		this.start();
		try {
			return await fn();
		} finally {
			this.stop();
		}
	}
}

/**
 * Minimal brain interface for simulation
 * Matches the core methods from AIBrain in cloudflare-do
 */
export interface SimulationBrain {
	readonly type: string;
	initialize(profile: SimulationProfile): Promise<void>;
	decide(context: SimulationContext): Promise<SimulationDecision>;
	dispose(): void;
}

/**
 * Minimal profile interface for simulation
 */
export interface SimulationProfile {
	id: string;
	name: string;
	avatarSeed: string;
	tagline: string;
	brain: string;
	skillLevel: number;
	traits: SimulationTraits;
	timing: SimulationTiming;
}

export interface SimulationTraits {
	riskTolerance: number;
	diceeChaser: number;
	upperSectionFocus: number;
	usesAllRolls: number;
	thinkingTime: number;
	chattiness: number;
}

export interface SimulationTiming {
	rollDecisionMs: number;
	keepDecisionMs: number;
	scoreDecisionMs: number;
	varianceMs: number;
	thinkingMultiplier: number;
}

/**
 * Minimal context interface for simulation
 */
export interface SimulationContext {
	dice: [number, number, number, number, number];
	keptDice: [boolean, boolean, boolean, boolean, boolean];
	rollsRemaining: number;
	scorecard: Record<string, number | null>;
	round: number;
	opponentScores: Array<{
		playerId: string;
		scorecard: Record<string, number | null>;
		totalScore: number;
	}>;
	isFinalRound: boolean;
	scoreDifferential: number;
}

/**
 * Minimal decision interface for simulation
 */
export interface SimulationDecision {
	action: 'roll' | 'keep' | 'score';
	keepMask?: [boolean, boolean, boolean, boolean, boolean];
	category?: string;
	reasoning?: string;
	confidence?: number;
}

/**
 * Wraps a brain to use seeded RNG for deterministic decisions
 */
export class BrainRngAdapter implements SimulationBrain {
	private override: MathRandomOverride;

	constructor(
		private brain: SimulationBrain,
		rng: RandomSource,
	) {
		this.override = new MathRandomOverride(rng);
	}

	get type(): string {
		return this.brain.type;
	}

	async initialize(profile: SimulationProfile): Promise<void> {
		return this.override.withOverrideAsync(() => this.brain.initialize(profile));
	}

	async decide(context: SimulationContext): Promise<SimulationDecision> {
		return this.override.withOverrideAsync(() => this.brain.decide(context));
	}

	dispose(): void {
		this.brain.dispose();
	}
}

/**
 * Create an adapted brain with seeded RNG
 */
export function createAdaptedBrain(brain: SimulationBrain, rng: RandomSource): BrainRngAdapter {
	return new BrainRngAdapter(brain, rng);
}

/**
 * Execute a function with deterministic Math.random
 */
export function withDeterministicRandom<T>(rng: RandomSource, fn: () => T): T {
	const override = new MathRandomOverride(rng);
	return override.withOverride(fn);
}

/**
 * Execute an async function with deterministic Math.random
 */
export async function withDeterministicRandomAsync<T>(
	rng: RandomSource,
	fn: () => Promise<T>,
): Promise<T> {
	const override = new MathRandomOverride(rng);
	return override.withOverrideAsync(fn);
}
