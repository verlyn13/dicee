/**
 * Audio Store
 *
 * Svelte 5 reactive store for audio and haptic preferences.
 * Wraps the audio service with persistent user preferences.
 *
 * NOTE: Haptic feedback (Vibration API) is NOT supported on iOS Safari.
 * Haptic settings only affect Android and some desktop browsers.
 */

import { audio as audioManager, type SoundCategory, type SoundId } from '$lib/services/audio';
import { isHapticsSupported } from '$lib/utils/haptics';

// =============================================================================
// Types
// =============================================================================

export interface AudioPreferences {
	// Audio settings
	masterVolume: number;
	diceVolume: number;
	uiVolume: number;
	scoreVolume: number;
	systemVolume: number;
	muted: boolean;
	// Haptic settings (Android only - iOS does NOT support Vibration API)
	hapticsEnabled: boolean;
}

const STORAGE_KEY = 'dicee_audio_preferences';

const DEFAULT_PREFERENCES: AudioPreferences = {
	masterVolume: 0.7,
	diceVolume: 1,
	uiVolume: 0.5,
	scoreVolume: 0.8,
	systemVolume: 0.6,
	muted: false,
	hapticsEnabled: true, // Enabled by default, gracefully degrades on iOS
};

// =============================================================================
// Audio Store Class
// =============================================================================

class AudioStore {
	// State
	#preferences = $state<AudioPreferences>({ ...DEFAULT_PREFERENCES });
	#initialized = $state(false);
	#supported = $state(false);
	#userInteracted = $state(false);

	// =========================================================================
	// Derived State
	// =========================================================================

	/**
	 * Whether audio system is ready to play sounds.
	 */
	get isReady(): boolean {
		return this.#initialized && this.#supported && this.#userInteracted;
	}

	/**
	 * Whether audio system has been initialized.
	 */
	get initialized(): boolean {
		return this.#initialized;
	}

	/**
	 * Whether browser supports Web Audio API.
	 */
	get supported(): boolean {
		return this.#supported;
	}

	/**
	 * Whether user has interacted with the page (required for autoplay).
	 */
	get userInteracted(): boolean {
		return this.#userInteracted;
	}

	/**
	 * Current audio preferences.
	 */
	get preferences(): AudioPreferences {
		return this.#preferences;
	}

	/**
	 * Master volume (0-1).
	 */
	get masterVolume(): number {
		return this.#preferences.masterVolume;
	}

	/**
	 * Whether audio is muted.
	 */
	get isMuted(): boolean {
		return this.#preferences.muted;
	}

	/**
	 * Whether haptics are enabled.
	 * Note: iOS does NOT support the Vibration API - this only affects Android.
	 */
	get hapticsEnabled(): boolean {
		return this.#preferences.hapticsEnabled && isHapticsSupported();
	}

	/**
	 * Effective master volume (accounts for mute).
	 */
	effectiveMasterVolume = $derived(this.#preferences.muted ? 0 : this.#preferences.masterVolume);

	/**
	 * Effective dice volume.
	 */
	effectiveDiceVolume = $derived(
		this.#preferences.muted ? 0 : this.#preferences.masterVolume * this.#preferences.diceVolume,
	);

	/**
	 * Effective UI volume.
	 */
	effectiveUiVolume = $derived(
		this.#preferences.muted ? 0 : this.#preferences.masterVolume * this.#preferences.uiVolume,
	);

	/**
	 * Effective score volume.
	 */
	effectiveScoreVolume = $derived(
		this.#preferences.muted ? 0 : this.#preferences.masterVolume * this.#preferences.scoreVolume,
	);

	/**
	 * Effective system volume.
	 */
	effectiveSystemVolume = $derived(
		this.#preferences.muted ? 0 : this.#preferences.masterVolume * this.#preferences.systemVolume,
	);

	// =========================================================================
	// Initialization
	// =========================================================================

	/**
	 * Initialize audio store and load preferences.
	 * Call early in app lifecycle.
	 */
	init(): void {
		if (this.#initialized) return;

		// Load preferences from localStorage
		this.#loadPreferences();

		// Check browser support (without creating context)
		this.#supported = typeof window !== 'undefined' && 'AudioContext' in window;

		this.#initialized = true;
	}

	/**
	 * Activate audio system after user interaction.
	 * Required due to browser autoplay policies.
	 */
	async activate(): Promise<boolean> {
		if (this.#userInteracted) {
			return this.#supported;
		}

		this.#userInteracted = true;

		// Initialize audio manager
		const success = await audioManager.init();
		this.#supported = success;

		// Apply stored preferences to audio manager
		if (success) {
			this.#applyPreferencesToManager();
		}

		return success;
	}

	// =========================================================================
	// Playback
	// =========================================================================

	/**
	 * Play a sound.
	 * Automatically initializes audio on first call if needed.
	 */
	async play(
		soundId: SoundId,
		options?: {
			volume?: number;
			pitch?: number;
			pan?: number;
		},
	): Promise<void> {
		// Auto-activate on first play attempt
		if (!this.#userInteracted) {
			await this.activate();
		}

		if (!this.#supported || this.#preferences.muted) {
			return;
		}

		await audioManager.play(soundId, options);
	}

	/**
	 * Play dice roll sound.
	 */
	async playDiceRoll(): Promise<void> {
		await this.play('diceRoll');
	}

	/**
	 * Play dice land sounds with slight timing variations.
	 */
	async playDiceLand(count: number = 5): Promise<void> {
		const sounds = Array.from({ length: count }, (_, i) => ({
			id: 'diceLand' as SoundId,
			delay: i * 30 + Math.random() * 20, // Staggered landing
			options: {
				pitch: 0.9 + Math.random() * 0.2, // Slight pitch variation
				pan: (i - 2) * 0.3, // Spread across stereo field
			},
		}));

		await audioManager.playSequence(sounds);
	}

	/**
	 * Play die keep/unkeep sound.
	 */
	async playDieToggle(kept: boolean): Promise<void> {
		await this.play(kept ? 'diceKeep' : 'diceUnkeep');
	}

	/**
	 * Play score confirmation sound.
	 */
	async playScoreConfirm(): Promise<void> {
		await this.play('scoreConfirm');
	}

	/**
	 * Play bonus achieved sound.
	 */
	async playBonusAchieved(): Promise<void> {
		await this.play('bonusAchieved');
	}

	/**
	 * Play Dicee celebration sound.
	 */
	async playDicee(): Promise<void> {
		await this.play('dicee');
	}

	/**
	 * Play turn change notification.
	 */
	async playTurnChange(): Promise<void> {
		await this.play('turnChange');
	}

	/**
	 * Play chat message notification.
	 */
	async playChatMessage(): Promise<void> {
		await this.play('chatMessage');
	}

	/**
	 * Play player join notification.
	 */
	async playPlayerJoin(): Promise<void> {
		await this.play('playerJoin');
	}

	/**
	 * Play player leave notification.
	 */
	async playPlayerLeave(): Promise<void> {
		await this.play('playerLeave');
	}

	/**
	 * Play game start sound.
	 */
	async playGameStart(): Promise<void> {
		await this.play('gameStart');
	}

	/**
	 * Play game end sound.
	 */
	async playGameEnd(): Promise<void> {
		await this.play('gameEnd');
	}

	// =========================================================================
	// Volume Control
	// =========================================================================

	/**
	 * Set master volume.
	 */
	setMasterVolume(volume: number): void {
		this.#preferences.masterVolume = Math.max(0, Math.min(1, volume));
		audioManager.setMasterVolume(this.#preferences.masterVolume);
		this.#savePreferences();
	}

	/**
	 * Set category volume.
	 */
	setCategoryVolume(category: SoundCategory, volume: number): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));

		switch (category) {
			case 'dice':
				this.#preferences.diceVolume = clampedVolume;
				break;
			case 'ui':
				this.#preferences.uiVolume = clampedVolume;
				break;
			case 'score':
				this.#preferences.scoreVolume = clampedVolume;
				break;
			case 'system':
				this.#preferences.systemVolume = clampedVolume;
				break;
		}

		audioManager.setCategoryVolume(category, clampedVolume);
		this.#savePreferences();
	}

	/**
	 * Toggle mute state.
	 */
	toggleMute(): boolean {
		this.#preferences.muted = !this.#preferences.muted;
		audioManager.setMuted(this.#preferences.muted);
		this.#savePreferences();
		return this.#preferences.muted;
	}

	/**
	 * Set mute state.
	 */
	setMuted(muted: boolean): void {
		this.#preferences.muted = muted;
		audioManager.setMuted(muted);
		this.#savePreferences();
	}

	// =========================================================================
	// Haptic Control
	// =========================================================================

	/**
	 * Toggle haptics enabled state.
	 * Note: Only affects Android - iOS does NOT support the Vibration API.
	 */
	toggleHaptics(): boolean {
		this.#preferences.hapticsEnabled = !this.#preferences.hapticsEnabled;
		this.#savePreferences();
		return this.#preferences.hapticsEnabled;
	}

	/**
	 * Set haptics enabled state.
	 * Note: Only affects Android - iOS does NOT support the Vibration API.
	 */
	setHapticsEnabled(enabled: boolean): void {
		this.#preferences.hapticsEnabled = enabled;
		this.#savePreferences();
	}

	// =========================================================================
	// Preferences
	// =========================================================================

	/**
	 * Reset all preferences to defaults.
	 */
	resetToDefaults(): void {
		this.#preferences = { ...DEFAULT_PREFERENCES };
		this.#applyPreferencesToManager();
		this.#savePreferences();
	}

	// =========================================================================
	// Private Methods
	// =========================================================================

	#loadPreferences(): void {
		if (typeof localStorage === 'undefined') return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<AudioPreferences>;
				this.#preferences = {
					...DEFAULT_PREFERENCES,
					...parsed,
				};
			}
		} catch {
			// Use defaults if storage fails
			this.#preferences = { ...DEFAULT_PREFERENCES };
		}
	}

	#savePreferences(): void {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#preferences));
		} catch {
			// Ignore storage errors
		}
	}

	#applyPreferencesToManager(): void {
		audioManager.setMasterVolume(this.#preferences.masterVolume);
		audioManager.setCategoryVolume('dice', this.#preferences.diceVolume);
		audioManager.setCategoryVolume('ui', this.#preferences.uiVolume);
		audioManager.setCategoryVolume('score', this.#preferences.scoreVolume);
		audioManager.setCategoryVolume('system', this.#preferences.systemVolume);
		audioManager.setMuted(this.#preferences.muted);
	}

	// =========================================================================
	// Testing Helpers
	// =========================================================================

	/**
	 * Testing utilities - not for production use.
	 */
	__testing = {
		reset: () => {
			this.#preferences = { ...DEFAULT_PREFERENCES };
			this.#initialized = false;
			this.#supported = false;
			this.#userInteracted = false;
		},
		setPreferences: (prefs: AudioPreferences) => {
			this.#preferences = { ...prefs };
		},
		setInitialized: (value: boolean) => {
			this.#initialized = value;
		},
		setSupported: (value: boolean) => {
			this.#supported = value;
		},
		setUserInteracted: (value: boolean) => {
			this.#userInteracted = value;
		},
	};
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Global audio store instance.
 */
export const audioStore = new AudioStore();
