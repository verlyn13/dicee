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
	/** Whether keyboard navigation is enabled. Can be boolean or getter for reactive updates. */
	enabled?: boolean | (() => boolean);
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

	/** Check if navigation is enabled (handles both boolean and getter) */
	function isEnabled(): boolean {
		const enabled = options.enabled ?? true;
		return typeof enabled === 'function' ? enabled() : enabled;
	}

	/** Check if user is typing in an input field */
	function isTypingInInput(target: EventTarget | null): boolean {
		return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
	}

	/** Get the action handler for a given key, if valid */
	function getKeyAction(key: string): (() => void) | null {
		// Roll dice (R or Space)
		if ((key === 'r' || key === ' ') && options.canRoll()) {
			return options.onRoll;
		}

		// Toggle individual dice (1-5)
		if (['1', '2', '3', '4', '5'].includes(key) && options.canKeep()) {
			const index = Number.parseInt(key, 10) - 1;
			return () => options.onToggleKeep(index);
		}

		// Keep all dice (A)
		if (key === 'a' && options.canKeep()) {
			return options.onKeepAll;
		}

		// Release all dice (Z)
		if (key === 'z' && options.canKeep()) {
			return options.onReleaseAll;
		}

		return null;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!isEnabled() || isTypingInInput(event.target)) {
			return;
		}

		const key = event.key.toLowerCase();
		state.lastKey = key;

		const action = getKeyAction(key);
		if (action) {
			event.preventDefault();
			action();
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
