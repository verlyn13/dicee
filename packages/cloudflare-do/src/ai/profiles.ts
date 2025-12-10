/**
 * Pre-built AI Profiles
 *
 * Five distinct AI opponents with different personalities and skill levels.
 * Each profile has a unique play style for varied gameplay experiences.
 */

import type { AIProfile, AITraits, AITiming } from './types';

// ============================================================================
// Default Timing Presets
// ============================================================================

const QUICK_TIMING: AITiming = {
	rollDecisionMs: 500,
	keepDecisionMs: 800,
	scoreDecisionMs: 1000,
	varianceMs: 300,
	thinkingMultiplier: 1.2,
};

const NORMAL_TIMING: AITiming = {
	rollDecisionMs: 1000,
	keepDecisionMs: 1500,
	scoreDecisionMs: 2000,
	varianceMs: 500,
	thinkingMultiplier: 1.5,
};

const DELIBERATE_TIMING: AITiming = {
	rollDecisionMs: 1500,
	keepDecisionMs: 2500,
	scoreDecisionMs: 3500,
	varianceMs: 800,
	thinkingMultiplier: 2.0,
};

const SLOW_TIMING: AITiming = {
	rollDecisionMs: 2000,
	keepDecisionMs: 3000,
	scoreDecisionMs: 4000,
	varianceMs: 1000,
	thinkingMultiplier: 2.5,
};

// ============================================================================
// Profile Definitions
// ============================================================================

/**
 * Riley - The Beginner
 *
 * A friendly newcomer who's still learning the game.
 * Makes suboptimal choices but plays with enthusiasm.
 * Good for new players to beat and build confidence.
 */
export const RILEY: AIProfile = {
	id: 'riley',
	name: 'Riley',
	avatarSeed: 'riley-beginner-dice',
	tagline: 'Still learning the ropes!',
	brain: 'personality',
	skillLevel: 0.35,
	traits: {
		riskTolerance: 0.3, // Conservative, plays it safe
		diceeChaser: 0.7, // Loves trying for Dicee (even when wrong)
		upperSectionFocus: 0.3, // Neglects upper section bonus
		usesAllRolls: 0.8, // Often uses all rolls even when unnecessary
		thinkingTime: 0.4, // Reasonably quick decisions
		chattiness: 0.8, // Very chatty, encouraging
	},
	timing: NORMAL_TIMING,
};

/**
 * Carmen - The Intermediate
 *
 * A balanced player who understands the fundamentals.
 * Makes decent strategic choices with occasional mistakes.
 * Good baseline opponent for average players.
 */
export const CARMEN: AIProfile = {
	id: 'carmen',
	name: 'Carmen',
	avatarSeed: 'carmen-intermediate-dice',
	tagline: 'May the dice be ever in your favor',
	brain: 'probabilistic',
	skillLevel: 0.6,
	traits: {
		riskTolerance: 0.5, // Balanced risk assessment
		diceeChaser: 0.4, // Realistic about Dicee chances
		upperSectionFocus: 0.5, // Balanced section strategy
		usesAllRolls: 0.5, // Uses rolls appropriately
		thinkingTime: 0.5, // Moderate pace
		chattiness: 0.5, // Occasional comments
	},
	timing: NORMAL_TIMING,
};

/**
 * Liam - The Risk-Taker
 *
 * An aggressive player who goes for big scores.
 * Will chase Dicees and large straights even when risky.
 * Can score big or crash spectacularly.
 */
export const LIAM: AIProfile = {
	id: 'liam',
	name: 'Liam',
	avatarSeed: 'liam-risktaker-dice',
	tagline: 'Go big or go home!',
	brain: 'personality',
	skillLevel: 0.7,
	traits: {
		riskTolerance: 0.9, // Very aggressive
		diceeChaser: 0.9, // Always chasing the dream
		upperSectionFocus: 0.2, // Ignores safe upper section points
		usesAllRolls: 0.9, // Always uses all rolls hoping for better
		thinkingTime: 0.3, // Quick, impulsive decisions
		chattiness: 0.7, // Expressive about big rolls
	},
	timing: QUICK_TIMING,
};

/**
 * Professor - The Expert
 *
 * A methodical player who uses optimal strategy.
 * Calculates expected values and rarely makes mistakes.
 * The toughest opponent for experienced players.
 */
export const PROFESSOR: AIProfile = {
	id: 'professor',
	name: 'Professor',
	avatarSeed: 'professor-expert-dice',
	tagline: 'The math never lies.',
	brain: 'optimal',
	skillLevel: 0.95,
	traits: {
		riskTolerance: 0.5, // Mathematically optimal risk
		diceeChaser: 0.3, // Only when EV positive
		upperSectionFocus: 0.6, // Prioritizes upper bonus appropriately
		usesAllRolls: 0.4, // Knows when to stop early
		thinkingTime: 0.8, // Takes time to calculate
		chattiness: 0.3, // Occasional analytical comments
	},
	timing: DELIBERATE_TIMING,
};

/**
 * Charlie - The Chaos Agent
 *
 * A wildcard player with unpredictable behavior.
 * Makes random decisions that occasionally work out.
 * Good for casual fun and unexpected outcomes.
 */
export const CHARLIE: AIProfile = {
	id: 'charlie',
	name: 'Charlie',
	avatarSeed: 'charlie-chaos-dice',
	tagline: 'Chaos is a ladder! Or a snake. Who knows?',
	brain: 'random',
	skillLevel: 0.2,
	traits: {
		riskTolerance: 0.5, // Varies wildly
		diceeChaser: 0.5, // Random pursuit
		upperSectionFocus: 0.5, // No strategy
		usesAllRolls: 0.7, // Usually rolls everything
		thinkingTime: 0.6, // Medium paced chaos
		chattiness: 0.9, // Very chatty, random comments
	},
	timing: SLOW_TIMING, // Pretends to think hard
};

// ============================================================================
// Profile Registry
// ============================================================================

/**
 * All available AI profiles, keyed by ID.
 */
export const AI_PROFILES: Record<string, AIProfile> = {
	riley: RILEY,
	carmen: CARMEN,
	liam: LIAM,
	professor: PROFESSOR,
	charlie: CHARLIE,
};

/**
 * Ordered list of profiles for UI display.
 * Sorted by approximate difficulty.
 */
export const PROFILE_LIST: AIProfile[] = [RILEY, CARMEN, LIAM, PROFESSOR, CHARLIE];

/**
 * Get a profile by ID.
 * Returns undefined if not found.
 */
export function getProfile(id: string): AIProfile | undefined {
	return AI_PROFILES[id];
}

/**
 * Get a random profile.
 * Useful for quick-start games.
 */
export function getRandomProfile(): AIProfile {
	const profiles = Object.values(AI_PROFILES);
	const index = Math.floor(Math.random() * profiles.length);
	return profiles[index];
}

/**
 * Get profiles filtered by difficulty.
 * @param maxSkill - Maximum skill level (0-1)
 */
export function getProfilesByDifficulty(maxSkill: number): AIProfile[] {
	return PROFILE_LIST.filter((p) => p.skillLevel <= maxSkill);
}

/**
 * Get the default profile for new players.
 */
export function getDefaultProfile(): AIProfile {
	return CARMEN;
}
