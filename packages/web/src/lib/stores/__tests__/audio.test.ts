/**
 * Audio Store Unit Tests
 *
 * Tests for audio.svelte.ts - Audio preferences and playback state management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioPreferences } from '../audio.svelte';
import { audioStore } from '../audio.svelte';

// =============================================================================
// Mock localStorage
// =============================================================================

const mockLocalStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		}),
	};
})();

vi.stubGlobal('localStorage', mockLocalStorage);

// Mock haptics support
vi.mock('$lib/utils/haptics', () => ({
	isHapticsSupported: vi.fn(() => true),
}));

// Mock audio service
vi.mock('$lib/services/audio', () => ({
	audio: {
		init: vi.fn().mockResolvedValue(true),
		play: vi.fn().mockResolvedValue(undefined),
		playSequence: vi.fn().mockResolvedValue(undefined),
		setMasterVolume: vi.fn(),
		setCategoryVolume: vi.fn(),
		setMuted: vi.fn(),
	},
}));

// =============================================================================
// Test Setup
// =============================================================================

const DEFAULT_PREFERENCES: AudioPreferences = {
	masterVolume: 0.7,
	diceVolume: 1,
	uiVolume: 0.5,
	scoreVolume: 0.8,
	systemVolume: 0.6,
	muted: false,
	hapticsEnabled: true,
};

describe('AudioStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		audioStore.__testing.reset();
		mockLocalStorage.clear();
		vi.clearAllMocks();
	});

	// ===========================================================================
	// Initial State
	// ===========================================================================

	describe('initial state', () => {
		it('should have default preferences', () => {
			expect(audioStore.preferences).toEqual(DEFAULT_PREFERENCES);
		});

		it('should not be initialized until init() is called', () => {
			expect(audioStore.initialized).toBe(false);
		});

		it('should have default master volume of 0.7', () => {
			expect(audioStore.masterVolume).toBe(0.7);
		});

		it('should not be muted by default', () => {
			expect(audioStore.isMuted).toBe(false);
		});

		it('should have haptics enabled by default', () => {
			expect(audioStore.hapticsEnabled).toBe(true);
		});

		it('should not have user interacted initially', () => {
			expect(audioStore.userInteracted).toBe(false);
		});
	});

	// ===========================================================================
	// Initialization
	// ===========================================================================

	describe('initialization', () => {
		it('should set initialized to true after init()', () => {
			audioStore.init();
			expect(audioStore.initialized).toBe(true);
		});

		it('should only initialize once', () => {
			audioStore.init();
			audioStore.init();
			// Should not throw and should stay initialized
			expect(audioStore.initialized).toBe(true);
		});

		it('should load preferences from localStorage on init', () => {
			const storedPrefs: AudioPreferences = {
				...DEFAULT_PREFERENCES,
				masterVolume: 0.5,
				muted: true,
			};
			mockLocalStorage.setItem('dicee_audio_preferences', JSON.stringify(storedPrefs));

			// Create a new reset state
			audioStore.__testing.reset();
			audioStore.init();

			expect(audioStore.masterVolume).toBe(0.5);
			expect(audioStore.isMuted).toBe(true);
		});

		it('should use defaults if localStorage is empty', () => {
			audioStore.init();
			expect(audioStore.preferences).toEqual(DEFAULT_PREFERENCES);
		});

		it('should handle corrupted localStorage gracefully', () => {
			mockLocalStorage.setItem('dicee_audio_preferences', 'not valid json');

			audioStore.__testing.reset();
			audioStore.init();

			expect(audioStore.preferences).toEqual(DEFAULT_PREFERENCES);
		});

		it('should merge partial preferences with defaults', () => {
			const partialPrefs = { masterVolume: 0.3 };
			mockLocalStorage.setItem('dicee_audio_preferences', JSON.stringify(partialPrefs));

			audioStore.__testing.reset();
			audioStore.init();

			expect(audioStore.masterVolume).toBe(0.3);
			expect(audioStore.preferences.diceVolume).toBe(1); // Still has default
		});
	});

	// ===========================================================================
	// Activation
	// ===========================================================================

	describe('activation', () => {
		it('should set userInteracted to true after activate()', async () => {
			audioStore.init();
			await audioStore.activate();
			expect(audioStore.userInteracted).toBe(true);
		});

		it('should only activate once', async () => {
			audioStore.init();
			await audioStore.activate();
			await audioStore.activate();
			// Should not throw and should stay activated
			expect(audioStore.userInteracted).toBe(true);
		});

		it('should return supported state on activate', async () => {
			audioStore.init();
			const result = await audioStore.activate();
			expect(result).toBe(true);
		});
	});

	// ===========================================================================
	// Volume Control
	// ===========================================================================

	describe('volume control', () => {
		beforeEach(() => {
			audioStore.init();
		});

		it('should set master volume', () => {
			audioStore.setMasterVolume(0.5);
			expect(audioStore.masterVolume).toBe(0.5);
		});

		it('should clamp master volume to 0-1 range', () => {
			audioStore.setMasterVolume(1.5);
			expect(audioStore.masterVolume).toBe(1);

			audioStore.setMasterVolume(-0.5);
			expect(audioStore.masterVolume).toBe(0);
		});

		it('should set category volume', () => {
			audioStore.setCategoryVolume('dice', 0.8);
			expect(audioStore.preferences.diceVolume).toBe(0.8);
		});

		it('should set all category volumes', () => {
			audioStore.setCategoryVolume('dice', 0.9);
			audioStore.setCategoryVolume('ui', 0.6);
			audioStore.setCategoryVolume('score', 0.7);
			audioStore.setCategoryVolume('system', 0.4);

			expect(audioStore.preferences.diceVolume).toBe(0.9);
			expect(audioStore.preferences.uiVolume).toBe(0.6);
			expect(audioStore.preferences.scoreVolume).toBe(0.7);
			expect(audioStore.preferences.systemVolume).toBe(0.4);
		});

		it('should persist volume changes to localStorage', () => {
			audioStore.setMasterVolume(0.3);
			expect(mockLocalStorage.setItem).toHaveBeenCalled();
		});
	});

	// ===========================================================================
	// Mute Toggle
	// ===========================================================================

	describe('mute toggle', () => {
		beforeEach(() => {
			audioStore.init();
		});

		it('should toggle mute state', () => {
			expect(audioStore.isMuted).toBe(false);
			audioStore.toggleMute();
			expect(audioStore.isMuted).toBe(true);
			audioStore.toggleMute();
			expect(audioStore.isMuted).toBe(false);
		});

		it('should return new mute state from toggleMute', () => {
			const result1 = audioStore.toggleMute();
			expect(result1).toBe(true);

			const result2 = audioStore.toggleMute();
			expect(result2).toBe(false);
		});

		it('should set mute state directly', () => {
			audioStore.setMuted(true);
			expect(audioStore.isMuted).toBe(true);
			audioStore.setMuted(false);
			expect(audioStore.isMuted).toBe(false);
		});

		it('should persist mute state to localStorage', () => {
			audioStore.toggleMute();
			expect(mockLocalStorage.setItem).toHaveBeenCalled();
		});
	});

	// ===========================================================================
	// Haptics Toggle
	// ===========================================================================

	describe('haptics toggle', () => {
		beforeEach(() => {
			audioStore.init();
		});

		it('should toggle haptics state', () => {
			expect(audioStore.preferences.hapticsEnabled).toBe(true);
			audioStore.toggleHaptics();
			expect(audioStore.preferences.hapticsEnabled).toBe(false);
			audioStore.toggleHaptics();
			expect(audioStore.preferences.hapticsEnabled).toBe(true);
		});

		it('should return new haptics state from toggleHaptics', () => {
			const result1 = audioStore.toggleHaptics();
			expect(result1).toBe(false);

			const result2 = audioStore.toggleHaptics();
			expect(result2).toBe(true);
		});

		it('should set haptics state directly', () => {
			audioStore.setHapticsEnabled(false);
			expect(audioStore.preferences.hapticsEnabled).toBe(false);
			audioStore.setHapticsEnabled(true);
			expect(audioStore.preferences.hapticsEnabled).toBe(true);
		});
	});

	// ===========================================================================
	// Derived State
	// ===========================================================================

	describe('derived state', () => {
		beforeEach(() => {
			audioStore.init();
		});

		it('should compute effectiveMasterVolume based on mute', () => {
			audioStore.setMasterVolume(0.8);
			expect(audioStore.effectiveMasterVolume).toBe(0.8);

			audioStore.setMuted(true);
			expect(audioStore.effectiveMasterVolume).toBe(0);
		});

		it('should compute effectiveDiceVolume', () => {
			audioStore.setMasterVolume(0.5);
			audioStore.setCategoryVolume('dice', 0.8);
			expect(audioStore.effectiveDiceVolume).toBe(0.4); // 0.5 * 0.8

			audioStore.setMuted(true);
			expect(audioStore.effectiveDiceVolume).toBe(0);
		});

		it('should compute effectiveUiVolume', () => {
			audioStore.setMasterVolume(0.5);
			audioStore.setCategoryVolume('ui', 0.6);
			expect(audioStore.effectiveUiVolume).toBe(0.3); // 0.5 * 0.6

			audioStore.setMuted(true);
			expect(audioStore.effectiveUiVolume).toBe(0);
		});

		it('should compute effectiveScoreVolume', () => {
			audioStore.setMasterVolume(0.5);
			audioStore.setCategoryVolume('score', 1);
			expect(audioStore.effectiveScoreVolume).toBe(0.5);

			audioStore.setMuted(true);
			expect(audioStore.effectiveScoreVolume).toBe(0);
		});

		it('should compute effectiveSystemVolume', () => {
			audioStore.setMasterVolume(0.5);
			audioStore.setCategoryVolume('system', 0.8);
			expect(audioStore.effectiveSystemVolume).toBe(0.4);

			audioStore.setMuted(true);
			expect(audioStore.effectiveSystemVolume).toBe(0);
		});
	});

	// ===========================================================================
	// Ready State
	// ===========================================================================

	describe('isReady state', () => {
		it('should not be ready initially', () => {
			expect(audioStore.isReady).toBe(false);
		});

		it('should not be ready after only init()', () => {
			audioStore.init();
			expect(audioStore.isReady).toBe(false);
		});

		it('should be ready after init() and activate()', async () => {
			audioStore.init();
			await audioStore.activate();
			expect(audioStore.isReady).toBe(true);
		});
	});

	// ===========================================================================
	// Reset to Defaults
	// ===========================================================================

	describe('resetToDefaults', () => {
		beforeEach(() => {
			audioStore.init();
		});

		it('should reset all preferences to defaults', () => {
			// Change some values
			audioStore.setMasterVolume(0.2);
			audioStore.setCategoryVolume('dice', 0.3);
			audioStore.setMuted(true);
			audioStore.setHapticsEnabled(false);

			// Reset
			audioStore.resetToDefaults();

			expect(audioStore.preferences).toEqual(DEFAULT_PREFERENCES);
		});

		it('should persist reset to localStorage', () => {
			audioStore.setMasterVolume(0.2);
			mockLocalStorage.setItem.mockClear();

			audioStore.resetToDefaults();
			expect(mockLocalStorage.setItem).toHaveBeenCalled();
		});
	});

	// ===========================================================================
	// Convenience Play Methods
	// ===========================================================================

	describe('convenience play methods', () => {
		beforeEach(async () => {
			audioStore.init();
			await audioStore.activate();
			audioStore.__testing.setSupported(true);
		});

		it('should have playDiceRoll method', async () => {
			await expect(audioStore.playDiceRoll()).resolves.toBeUndefined();
		});

		it('should have playDiceLand method', async () => {
			await expect(audioStore.playDiceLand(5)).resolves.toBeUndefined();
		});

		it('should have playDieToggle method', async () => {
			await expect(audioStore.playDieToggle(true)).resolves.toBeUndefined();
			await expect(audioStore.playDieToggle(false)).resolves.toBeUndefined();
		});

		it('should have playScoreConfirm method', async () => {
			await expect(audioStore.playScoreConfirm()).resolves.toBeUndefined();
		});

		it('should have playBonusAchieved method', async () => {
			await expect(audioStore.playBonusAchieved()).resolves.toBeUndefined();
		});

		it('should have playDicee method', async () => {
			await expect(audioStore.playDicee()).resolves.toBeUndefined();
		});

		it('should have playTurnChange method', async () => {
			await expect(audioStore.playTurnChange()).resolves.toBeUndefined();
		});

		it('should have playChatMessage method', async () => {
			await expect(audioStore.playChatMessage()).resolves.toBeUndefined();
		});

		it('should have playPlayerJoin method', async () => {
			await expect(audioStore.playPlayerJoin()).resolves.toBeUndefined();
		});

		it('should have playPlayerLeave method', async () => {
			await expect(audioStore.playPlayerLeave()).resolves.toBeUndefined();
		});

		it('should have playGameStart method', async () => {
			await expect(audioStore.playGameStart()).resolves.toBeUndefined();
		});

		it('should have playGameEnd method', async () => {
			await expect(audioStore.playGameEnd()).resolves.toBeUndefined();
		});
	});

	// ===========================================================================
	// Edge Cases
	// ===========================================================================

	describe('edge cases', () => {
		it('should handle rapid volume changes', () => {
			audioStore.init();
			for (let i = 0; i <= 10; i++) {
				audioStore.setMasterVolume(i / 10);
			}
			expect(audioStore.masterVolume).toBe(1);
		});

		it('should handle volume at boundaries', () => {
			audioStore.init();

			audioStore.setMasterVolume(0);
			expect(audioStore.masterVolume).toBe(0);

			audioStore.setMasterVolume(1);
			expect(audioStore.masterVolume).toBe(1);
		});

		it('should not play when muted', async () => {
			audioStore.init();
			await audioStore.activate();
			audioStore.setMuted(true);

			// Should not throw when muted
			await audioStore.play('diceRoll');
			expect(audioStore.isMuted).toBe(true);
		});
	});
});
