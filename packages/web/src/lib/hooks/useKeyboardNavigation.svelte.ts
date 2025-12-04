/**
 * Keyboard Navigation Hook
 *
 * Provides keyboard shortcuts for game actions:
 * - R or Space: Roll dice
 * - 1-5: Toggle keep for dice at that position
 * - A: Keep all dice
 * - Z: Release all dice
 * - Escape: Reset current selection
 */

import { onDestroy, onMount } from 'svelte';

export interface KeyboardNavigationOptions {
	onRoll: () => void;
	onToggleKeep: (index: number) => void;
	onKeepAll: () => void;
	onReleaseAll: () => void;
	canRoll: () => boolean;
	canKeep: () => boolean;
	enabled?: boolean;
}

export interface KeyboardNavigationState {
	lastKey: string | null;
	isListening: boolean;
}

/**
 * Creates keyboard navigation for the dice game
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions): KeyboardNavigationState {
	const state = $state<KeyboardNavigationState>({
		lastKey: null,
		isListening: false,
	});

	const enabled = options.enabled ?? true;

	function handleKeyDown(event: KeyboardEvent) {
		if (!enabled) return;

		// Ignore if typing in an input
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		const key = event.key.toLowerCase();
		state.lastKey = key;

		switch (key) {
			// Roll dice
			case 'r':
			case ' ':
				if (options.canRoll()) {
					event.preventDefault();
					options.onRoll();
				}
				break;

			// Toggle individual dice (1-5)
			case '1':
			case '2':
			case '3':
			case '4':
			case '5':
				if (options.canKeep()) {
					event.preventDefault();
					const index = Number.parseInt(key, 10) - 1;
					options.onToggleKeep(index);
				}
				break;

			// Keep all dice
			case 'a':
				if (options.canKeep()) {
					event.preventDefault();
					options.onKeepAll();
				}
				break;

			// Release all dice
			case 'z':
				if (options.canKeep()) {
					event.preventDefault();
					options.onReleaseAll();
				}
				break;

			// No action for other keys
			default:
				break;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
			state.isListening = true;
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
			state.isListening = false;
		}
	});

	return state;
}

/**
 * Key binding descriptions for help display
 */
export const KEY_BINDINGS = [
	{ key: 'R / Space', action: 'Roll dice' },
	{ key: '1-5', action: 'Toggle keep for dice' },
	{ key: 'A', action: 'Keep all dice' },
	{ key: 'Z', action: 'Release all dice' },
] as const;
