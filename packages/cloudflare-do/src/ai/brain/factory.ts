/**
 * AI Brain Factory
 *
 * Creates brain instances based on profile configuration.
 * Handles WASM loading and fallback strategies.
 */

import type { AIProfile, BrainType } from '../types';
import type { AIBrain } from './types';

// Brain implementations are lazily imported to reduce initial load
// and allow for dynamic switching between WASM and TypeScript

/**
 * Registry of brain constructors by type.
 * Populated as brains are loaded.
 */
const brainRegistry: Map<BrainType, () => Promise<AIBrain>> = new Map();

/**
 * Whether WASM engine is available.
 * Set during initialization.
 */
let wasmAvailable = false;

/**
 * Register a brain constructor.
 *
 * @param type - Brain type identifier
 * @param factory - Async factory function
 */
export function registerBrain(type: BrainType, factory: () => Promise<AIBrain>): void {
	brainRegistry.set(type, factory);
}

/**
 * Check if WASM engine is available in this environment.
 */
export async function checkWasmAvailability(): Promise<boolean> {
	try {
		// Try to load the WASM module
		// This will be implemented in the WASM spike (ai-3)
		// For now, return false to use TypeScript fallback
		return false;
	} catch {
		return false;
	}
}

/**
 * Initialize the brain factory.
 * Must be called before creating brains.
 *
 * @param forceTypescript - Skip WASM and use TypeScript only
 */
export async function initializeBrainFactory(forceTypescript = false): Promise<void> {
	if (!forceTypescript) {
		wasmAvailable = await checkWasmAvailability();
	}

	// Register default brain implementations
	// These will be replaced with actual implementations in subsequent tasks

	registerBrain('optimal', async () => {
		if (wasmAvailable) {
			// Use WASM-based optimal brain
			const { OptimalBrain } = await import('./optimal');
			return new OptimalBrain(true);
		}
		// Fall back to TypeScript implementation
		const { OptimalBrain } = await import('./optimal');
		return new OptimalBrain(false);
	});

	registerBrain('probabilistic', async () => {
		const { ProbabilisticBrain } = await import('./probabilistic');
		return new ProbabilisticBrain();
	});

	registerBrain('personality', async () => {
		const { PersonalityBrain } = await import('./personality');
		return new PersonalityBrain();
	});

	registerBrain('random', async () => {
		const { RandomBrain } = await import('./random');
		return new RandomBrain();
	});

	// LLM brain is not implemented yet
	registerBrain('llm', async () => {
		throw new Error('LLM brain not yet implemented');
	});
}

/**
 * Create a brain instance for an AI profile.
 *
 * @param profile - The AI profile
 * @returns Initialized brain instance
 */
export async function createBrain(profile: AIProfile): Promise<AIBrain> {
	const factory = brainRegistry.get(profile.brain);

	if (!factory) {
		throw new Error(`Unknown brain type: ${profile.brain}`);
	}

	const brain = await factory();
	await brain.initialize(profile);

	return brain;
}

/**
 * Get the list of available brain types.
 */
export function getAvailableBrainTypes(): BrainType[] {
	return Array.from(brainRegistry.keys());
}

/**
 * Check if a specific brain type is available.
 */
export function isBrainTypeAvailable(type: BrainType): boolean {
	return brainRegistry.has(type);
}

/**
 * Check if WASM engine is being used.
 */
export function isWasmEnabled(): boolean {
	return wasmAvailable;
}
