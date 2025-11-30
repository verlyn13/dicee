/**
 * Dice State Management
 * Svelte 5 runes-based dice state with roll/keep logic
 */

import type { DiceArray, DieValue, KeptMask } from '../types.js';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DICE: DiceArray = [1, 1, 1, 1, 1];
const DEFAULT_KEPT: KeptMask = [false, false, false, false, false];

// =============================================================================
// Utility Functions
// =============================================================================

export function rollSingleDie(): DieValue {
	return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

export function rollAllDice(): DiceArray {
	return [
		rollSingleDie(),
		rollSingleDie(),
		rollSingleDie(),
		rollSingleDie(),
		rollSingleDie(),
	];
}

export function rerollDice(current: DiceArray, kept: KeptMask): DiceArray {
	return current.map((die, i) =>
		kept[i] ? die : rollSingleDie(),
	) as DiceArray;
}

export function countKept(kept: KeptMask): number {
	return kept.filter(Boolean).length;
}

export function allKept(kept: KeptMask): boolean {
	return kept.every(Boolean);
}

export function noneKept(kept: KeptMask): boolean {
	return kept.every((k) => !k);
}

// =============================================================================
// Dice Class (Svelte 5 Runes)
// =============================================================================

export class DiceState {
	// Core state
	#values = $state<DiceArray>([...DEFAULT_DICE] as DiceArray);
	#kept = $state<KeptMask>([...DEFAULT_KEPT] as KeptMask);
	#isRolling = $state(false);

	// Derived values
	readonly keptCount = $derived(countKept(this.#kept));
	readonly allKept = $derived(allKept(this.#kept));
	readonly noneKept = $derived(noneKept(this.#kept));
	readonly diceToRoll = $derived(5 - this.keptCount);

	// Sum of all dice
	readonly total = $derived(this.#values.reduce((sum, d) => sum + d, 0));

	// Sum of kept dice
	readonly keptTotal = $derived(
		this.#values.reduce((sum, d, i) => (this.#kept[i] ? sum + d : sum), 0),
	);

	// Dice counts (for display)
	readonly counts = $derived(() => {
		const c = [0, 0, 0, 0, 0, 0]; // counts for 1-6
		for (const v of this.#values) {
			c[v - 1]++;
		}
		return c;
	});

	// Getters
	get values(): DiceArray {
		return this.#values;
	}

	get kept(): KeptMask {
		return this.#kept;
	}

	get isRolling(): boolean {
		return this.#isRolling;
	}

	getValue(index: number): DieValue {
		return this.#values[index];
	}

	isKept(index: number): boolean {
		return this.#kept[index];
	}

	// Actions
	roll(): DiceArray {
		if (this.#isRolling) {
			return this.#values;
		}

		this.#values = rerollDice(this.#values, this.#kept);
		return this.#values;
	}

	async rollAnimated(durationMs: number = 500): Promise<DiceArray> {
		if (this.#isRolling) {
			return this.#values;
		}

		this.#isRolling = true;

		// Animate: quick random values during roll
		const startTime = Date.now();
		const animationFrame = () => {
			const elapsed = Date.now() - startTime;
			if (elapsed < durationMs) {
				// Show random values for dice being rolled
				this.#values = this.#values.map((v, i) =>
					this.#kept[i] ? v : rollSingleDie(),
				) as DiceArray;
				requestAnimationFrame(animationFrame);
			} else {
				// Final roll
				this.#values = rerollDice(this.#values, this.#kept);
				this.#isRolling = false;
			}
		};

		requestAnimationFrame(animationFrame);

		// Return promise that resolves when animation completes
		return new Promise((resolve) => {
			setTimeout(() => resolve(this.#values), durationMs + 50);
		});
	}

	toggleKeep(index: number): void {
		if (index < 0 || index > 4) return;
		this.#kept[index] = !this.#kept[index];
	}

	setKept(index: number, kept: boolean): void {
		if (index < 0 || index > 4) return;
		this.#kept[index] = kept;
	}

	keepAll(): void {
		this.#kept = [true, true, true, true, true];
	}

	releaseAll(): void {
		this.#kept = [false, false, false, false, false];
	}

	setKeptMask(mask: KeptMask): void {
		this.#kept = [...mask] as KeptMask;
	}

	reset(): void {
		this.#values = [...DEFAULT_DICE] as DiceArray;
		this.#kept = [...DEFAULT_KEPT] as KeptMask;
		this.#isRolling = false;
	}

	// For initial roll at start of turn
	rollFresh(): DiceArray {
		this.releaseAll();
		return this.roll();
	}

	// Serialization
	toJSON(): { values: DiceArray; kept: KeptMask } {
		return {
			values: [...this.#values] as DiceArray,
			kept: [...this.#kept] as KeptMask,
		};
	}

	fromJSON(data: { values: DiceArray; kept: KeptMask }): void {
		this.#values = [...data.values] as DiceArray;
		this.#kept = [...data.kept] as KeptMask;
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const dice = new DiceState();
