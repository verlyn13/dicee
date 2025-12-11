/**
 * Seeded Random Number Generator
 *
 * Implements xoshiro128** PRNG for deterministic, high-quality random numbers.
 * Same seed always produces same sequence - critical for reproducible simulations.
 *
 * @example
 * const rng = new SeededRandom(42);
 * const value = rng.random();           // 0 <= value < 1
 * const die = rng.randomInt(1, 6);      // 1, 2, 3, 4, 5, or 6
 * const forked = rng.fork('player-1');  // Independent stream
 */

/**
 * Interface for random number sources
 */
export interface RandomSource {
	/** Returns a random float in [0, 1) */
	random(): number;

	/** Returns a random integer in [min, max] inclusive */
	randomInt(min: number, max: number): number;

	/** Returns a random element from array */
	randomChoice<T>(array: readonly T[]): T;

	/** Shuffles array in place and returns it */
	shuffle<T>(array: T[]): T[];

	/** Returns true with given probability (0-1) */
	randomChance(probability: number): boolean;

	/** Creates an independent random stream with derived seed */
	fork(salt: string): RandomSource;

	/** Returns the current seed (for serialization) */
	getSeed(): number;
}

/**
 * xoshiro128** PRNG implementation
 *
 * Properties:
 * - 128-bit state (4 x 32-bit words)
 * - Period: 2^128 - 1
 * - Passes BigCrush and PractRand tests
 * - Very fast: ~1.2ns per number
 */
export class SeededRandom implements RandomSource {
	private state: Uint32Array;
	private readonly initialSeed: number;

	constructor(seed: number) {
		this.initialSeed = seed;
		this.state = new Uint32Array(4);
		this.initializeState(seed);
	}

	/**
	 * Initialize state from seed using SplitMix64
	 * SplitMix64 is used to expand the seed into the full state
	 */
	private initializeState(seed: number): void {
		// Use SplitMix64 to generate initial state
		let s = BigInt(seed >>> 0);

		for (let i = 0; i < 4; i++) {
			s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
			let z = s;
			z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
			z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
			z = z ^ (z >> 31n);
			this.state[i] = Number(z & 0xffffffffn);
		}

		// Ensure state is never all zeros
		if (this.state.every((v) => v === 0)) {
			this.state[0] = 1;
		}
	}

	/**
	 * Rotate left helper
	 */
	private rotl(x: number, k: number): number {
		return ((x << k) | (x >>> (32 - k))) >>> 0;
	}

	/**
	 * Generate next 32-bit value using xoshiro128**
	 */
	private next(): number {
		const s = this.state;

		// xoshiro128** scrambler
		const result = (this.rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;

		// State update
		const t = (s[1] << 9) >>> 0;
		s[2] ^= s[0];
		s[3] ^= s[1];
		s[1] ^= s[2];
		s[0] ^= s[3];
		s[2] ^= t;
		s[3] = this.rotl(s[3], 11);

		return result;
	}

	/**
	 * Returns a random float in [0, 1)
	 */
	random(): number {
		// Convert to float in [0, 1) with 32 bits of precision
		return this.next() / 0x100000000;
	}

	/**
	 * Returns a random integer in [min, max] inclusive
	 */
	randomInt(min: number, max: number): number {
		const range = max - min + 1;
		return min + Math.floor(this.random() * range);
	}

	/**
	 * Returns a random element from array
	 */
	randomChoice<T>(array: readonly T[]): T {
		if (array.length === 0) {
			throw new Error('Cannot choose from empty array');
		}
		return array[this.randomInt(0, array.length - 1)];
	}

	/**
	 * Shuffles array in place using Fisher-Yates algorithm
	 */
	shuffle<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = this.randomInt(0, i);
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	/**
	 * Returns true with given probability (0-1)
	 */
	randomChance(probability: number): boolean {
		return this.random() < probability;
	}

	/**
	 * Creates an independent random stream with derived seed
	 * Uses the salt to create a deterministic but different stream
	 */
	fork(salt: string): SeededRandom {
		// Hash the salt to create a seed modifier
		let hash = 0;
		for (let i = 0; i < salt.length; i++) {
			hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
		}

		// Combine with current state for derived seed
		const derivedSeed = (this.next() ^ (hash >>> 0)) >>> 0;
		return new SeededRandom(derivedSeed);
	}

	/**
	 * Returns the initial seed
	 */
	getSeed(): number {
		return this.initialSeed;
	}

	/**
	 * Returns a random float with normal (Gaussian) distribution
	 * Uses Box-Muller transform
	 */
	randomGaussian(mean = 0, stdDev = 1): number {
		const u1 = this.random();
		const u2 = this.random();

		// Box-Muller transform
		const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

		return z0 * stdDev + mean;
	}

	/**
	 * Returns N random floats in [0, 1)
	 */
	randomArray(n: number): number[] {
		const result: number[] = new Array(n);
		for (let i = 0; i < n; i++) {
			result[i] = this.random();
		}
		return result;
	}

	/**
	 * Sample n items from array without replacement
	 */
	sample<T>(array: readonly T[], n: number): T[] {
		if (n > array.length) {
			throw new Error(`Cannot sample ${n} items from array of length ${array.length}`);
		}

		// Copy and shuffle, then take first n
		const copy = [...array];
		this.shuffle(copy);
		return copy.slice(0, n);
	}

	/**
	 * Returns weighted random index based on weights array
	 */
	weightedChoice(weights: readonly number[]): number {
		const totalWeight = weights.reduce((sum, w) => sum + w, 0);
		let random = this.random() * totalWeight;

		for (let i = 0; i < weights.length; i++) {
			random -= weights[i];
			if (random <= 0) {
				return i;
			}
		}

		// Fallback to last index (shouldn't happen with valid weights)
		return weights.length - 1;
	}
}

/**
 * Create a SeededRandom instance from optional seed
 * If no seed provided, generates one from current time
 */
export function createRandom(seed?: number): SeededRandom {
	const actualSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
	return new SeededRandom(actualSeed);
}
