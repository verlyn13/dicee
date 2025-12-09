/**
 * Svelte Action: playSound
 *
 * Declarative audio playback for interactive elements.
 * Automatically handles user gesture requirements.
 *
 * @example
 * <button use:playSound={'diceRoll'}>Roll</button>
 * <button use:playSound={{ sound: 'buttonClick', volume: 0.5 }}>Click</button>
 */

import type { SoundId } from '$lib/services/audio';
import { audioStore } from '$lib/stores/audio.svelte';

type PlaySoundOptions =
	| SoundId
	| {
			sound: SoundId;
			volume?: number;
			pitch?: number;
	  };

/**
 * Svelte action to play a sound on click/touch.
 *
 * @param node - The HTML element to attach to
 * @param options - Sound ID or options object
 */
export function playSound(node: HTMLElement, options: PlaySoundOptions) {
	let currentOptions = normalizeOptions(options);

	function handler() {
		audioStore.play(currentOptions.sound, {
			volume: currentOptions.volume,
			pitch: currentOptions.pitch,
		});
	}

	// Listen to both click and touchend for responsiveness
	// Use touchend instead of touchstart to avoid conflicts with scrolling
	node.addEventListener('click', handler);

	return {
		update(newOptions: PlaySoundOptions) {
			currentOptions = normalizeOptions(newOptions);
		},
		destroy() {
			node.removeEventListener('click', handler);
		},
	};
}

function normalizeOptions(options: PlaySoundOptions): {
	sound: SoundId;
	volume?: number;
	pitch?: number;
} {
	if (typeof options === 'string') {
		return { sound: options };
	}
	return options;
}
