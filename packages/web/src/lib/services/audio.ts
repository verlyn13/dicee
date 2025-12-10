/**
 * Audio Service
 *
 * Web Audio API based sound system with lazy loading and volume controls.
 * Provides low-latency audio for game events.
 */

// =============================================================================
// Types
// =============================================================================

export type SoundCategory = 'dice' | 'ui' | 'score' | 'system';

export type SoundId =
	// Dice sounds
	| 'diceRoll'
	| 'diceLand'
	| 'diceKeep'
	| 'diceUnkeep'
	// Scoring sounds (range-based feedback per audio-plan.md)
	| 'scoreZero' // 0 points - scratch/forced zero
	| 'scoreNegative' // 1-15 points - low/disappointing
	| 'scorePositive' // 16-29 points - decent/neutral-good
	| 'scoreGood' // 30+ points - high score
	| 'bonusAchieved' // Upper section bonus (63+)
	| 'dicee' // Five of a kind (50 points)
	// UI sounds
	| 'buttonClick'
	| 'turnChange'
	| 'timerWarning'
	// System sounds
	| 'chatMessage'
	| 'playerJoin'
	| 'playerLeave'
	| 'gameStart'
	| 'gameEnd';

export interface SoundConfig {
	src: string;
	category: SoundCategory;
	volume: number;
	variants?: number; // For randomized sounds
	preload?: boolean;
}

export interface AudioState {
	initialized: boolean;
	supported: boolean;
	masterVolume: number;
	categoryVolumes: Record<SoundCategory, number>;
	muted: boolean;
}

// =============================================================================
// Sound Bank Configuration
// =============================================================================

/**
 * Sound bank with paths and default volumes.
 * Sounds are loaded lazily on first play unless marked for preload.
 */
export const SOUND_BANK: Record<SoundId, SoundConfig> = {
	// Dice (preloaded for responsiveness)
	// Paths follow audio-gen output structure: /audio/sfx/{category}/{filename}.ogg
	diceRoll: {
		src: '/audio/sfx/dice/dice_roll_heavy.ogg',
		category: 'dice',
		volume: 0.7,
		preload: true,
	},
	diceLand: {
		src: '/audio/sfx/dice/dice_roll_light.ogg',
		category: 'dice',
		volume: 0.5,
		variants: 3,
	},
	diceKeep: { src: '/audio/sfx/dice/dice_select.ogg', category: 'dice', volume: 0.3 },
	diceUnkeep: { src: '/audio/sfx/dice/dice_deselect.ogg', category: 'dice', volume: 0.25 },

	// Scoring (range-based feedback per audio-plan.md Section 4)
	// 0 points → scoreZero, 1-15 → scoreNegative, 16-29 → scorePositive, 30+ → scoreGood
	scoreZero: { src: '/audio/sfx/score/score_zero.ogg', category: 'score', volume: 0.35 },
	scoreNegative: { src: '/audio/sfx/score/score_negative.ogg', category: 'score', volume: 0.4 },
	scorePositive: {
		src: '/audio/sfx/score/score_positive.ogg',
		category: 'score',
		volume: 0.4,
		preload: true,
	},
	scoreGood: { src: '/audio/sfx/score/score_good.ogg', category: 'score', volume: 0.5 },
	bonusAchieved: { src: '/audio/sfx/score/upper_bonus.ogg', category: 'score', volume: 0.6 },
	dicee: { src: '/audio/sfx/score/dicee_fanfare.ogg', category: 'score', volume: 0.8 },

	// UI
	buttonClick: { src: '/audio/sfx/ui/btn_click.ogg', category: 'ui', volume: 0.2 },
	turnChange: { src: '/audio/sfx/ui/turn_start.ogg', category: 'ui', volume: 0.3 },
	timerWarning: { src: '/audio/sfx/ui/timer_tick.ogg', category: 'ui', volume: 0.4 },

	// System
	chatMessage: { src: '/audio/sfx/ui/chat_pop.ogg', category: 'system', volume: 0.2 },
	playerJoin: { src: '/audio/sfx/ui/player_join.ogg', category: 'system', volume: 0.3 },
	playerLeave: { src: '/audio/sfx/ui/player_leave.ogg', category: 'system', volume: 0.25 },
	gameStart: { src: '/audio/sfx/score/game_start.ogg', category: 'system', volume: 0.5 },
	gameEnd: { src: '/audio/sfx/score/game_end.ogg', category: 'system', volume: 0.5 },
};

// =============================================================================
// Audio Manager Class
// =============================================================================

class AudioManager {
	#context: AudioContext | null = null;
	#buffers = new Map<string, AudioBuffer>();
	#loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
	#masterGain: GainNode | null = null;
	#categoryGains = new Map<SoundCategory, GainNode>();
	#silentAudio: HTMLAudioElement | null = null;

	#state: AudioState = {
		initialized: false,
		supported: false,
		masterVolume: 0.7,
		categoryVolumes: {
			dice: 1,
			ui: 0.5,
			score: 0.8,
			system: 0.6,
		},
		muted: false,
	};

	// =========================================================================
	// Platform Detection
	// =========================================================================

	/**
	 * Check if running on iOS device.
	 */
	#isIOS(): boolean {
		if (typeof navigator === 'undefined') return false;
		return /iPhone|iPad|iPod/.test(navigator.userAgent);
	}

	// =========================================================================
	// Initialization
	// =========================================================================

	/**
	 * Initialize the audio system.
	 * Must be called after user interaction (browser autoplay policy).
	 */
	async init(): Promise<boolean> {
		if (this.#state.initialized) {
			return this.#state.supported;
		}

		// Check browser support
		if (typeof window === 'undefined' || !window.AudioContext) {
			this.#state.initialized = true;
			this.#state.supported = false;
			return false;
		}

		try {
			// Create audio context
			this.#context = new AudioContext();

			// Create master gain node
			this.#masterGain = this.#context.createGain();
			this.#masterGain.gain.value = this.#state.masterVolume;
			this.#masterGain.connect(this.#context.destination);

			// Create category gain nodes
			const categories: SoundCategory[] = ['dice', 'ui', 'score', 'system'];
			for (const category of categories) {
				const gain = this.#context.createGain();
				gain.gain.value = this.#state.categoryVolumes[category];
				gain.connect(this.#masterGain);
				this.#categoryGains.set(category, gain);
			}

			// iOS silent mode workaround - play silent audio to unlock media channel
			// This allows Web Audio API to work even with iOS ringer switch off
			if (this.#isIOS()) {
				this.#initIOSSilentModeWorkaround();
			}

			// Handle iOS AudioContext interrupted state
			this.#context.addEventListener('statechange', () => {
				if (this.#context?.state === 'interrupted') {
					// iOS interrupted - will need user gesture to resume
					console.log('AudioContext interrupted (iOS)');
				}
			});

			// Handle visibility changes (app backgrounded/foregrounded)
			if (typeof document !== 'undefined') {
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'visible') {
						this.resume().catch(() => {
							// May need user gesture, ignore
						});
					}
				});
			}

			this.#state.initialized = true;
			this.#state.supported = true;

			// Preload critical sounds
			await this.preloadCritical();

			return true;
		} catch (error) {
			console.warn('Audio initialization failed:', error);
			this.#state.initialized = true;
			this.#state.supported = false;
			return false;
		}
	}

	/**
	 * iOS silent mode workaround.
	 * Plays a silent audio element to unlock the media channel,
	 * allowing Web Audio API to work even with the ringer switch off.
	 */
	#initIOSSilentModeWorkaround(): void {
		try {
			// Create a silent audio element - uses HTML5 audio which ignores ringer
			this.#silentAudio = document.createElement('audio');
			// Use a data URI for a tiny silent audio file (avoids network request)
			this.#silentAudio.src =
				'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////' +
				'///////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
				'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
				'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
				'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////';
			this.#silentAudio.loop = true;
			this.#silentAudio.volume = 0.001; // Nearly silent
			this.#silentAudio.play().catch(() => {
				// Ignore errors - may require user gesture
			});
		} catch {
			// Silent fail - workaround is optional
		}
	}

	/**
	 * Resume audio context if suspended or interrupted (required after user interaction).
	 * iOS can transition AudioContext to 'interrupted' state on phone calls, tab switches, etc.
	 */
	async resume(): Promise<void> {
		// Handle both 'suspended' and iOS-specific 'interrupted' state
		if (
			this.#context &&
			(this.#context.state === 'suspended' || (this.#context.state as string) === 'interrupted')
		) {
			await this.#context.resume();
		}
	}

	/**
	 * Preload sounds marked as critical for low-latency playback.
	 */
	async preloadCritical(): Promise<void> {
		const preloadSounds = Object.entries(SOUND_BANK)
			.filter(([, config]) => config.preload)
			.map(([id]) => id as SoundId);

		await Promise.all(preloadSounds.map((id) => this.#loadSound(id)));
	}

	/**
	 * Preload specific sounds.
	 */
	async preload(soundIds: SoundId[]): Promise<void> {
		await Promise.all(soundIds.map((id) => this.#loadSound(id)));
	}

	// =========================================================================
	// Playback
	// =========================================================================

	/**
	 * Play a sound by ID.
	 *
	 * @param soundId - The sound to play
	 * @param options - Optional playback options
	 * @returns Promise that resolves when sound starts (not when it ends)
	 */
	async play(
		soundId: SoundId,
		options?: {
			volume?: number; // 0-1, multiplier on top of category volume
			pitch?: number; // Playback rate, 1 = normal
			pan?: number; // -1 to 1, left to right
		},
	): Promise<void> {
		if (!this.#state.supported || this.#state.muted || !this.#context || !this.#masterGain) {
			return;
		}

		// Resume context if needed
		await this.resume();

		const config = SOUND_BANK[soundId];
		if (!config) {
			console.warn(`Unknown sound: ${soundId}`);
			return;
		}

		// Handle variants
		let actualSoundId = soundId;
		if (config.variants && config.variants > 1) {
			const variant = Math.floor(Math.random() * config.variants) + 1;
			actualSoundId = `${soundId}_${variant}` as SoundId;
		}

		// Load sound if not already loaded
		const buffer = await this.#loadSound(soundId, actualSoundId);
		if (!buffer) {
			return;
		}

		try {
			// Create source
			const source = this.#context.createBufferSource();
			source.buffer = buffer;

			// Set playback rate (pitch)
			if (options?.pitch) {
				source.playbackRate.value = options.pitch;
			}

			// Create gain for this specific play
			const playGain = this.#context.createGain();
			const baseVolume = config.volume * (options?.volume ?? 1);
			playGain.gain.value = baseVolume;

			// Connect through category gain
			const categoryGain = this.#categoryGains.get(config.category);
			if (categoryGain) {
				playGain.connect(categoryGain);
			} else {
				playGain.connect(this.#masterGain);
			}

			// Add panning if specified
			if (options?.pan !== undefined && options.pan !== 0) {
				const panner = this.#context.createStereoPanner();
				panner.pan.value = Math.max(-1, Math.min(1, options.pan));
				source.connect(panner);
				panner.connect(playGain);
			} else {
				source.connect(playGain);
			}

			// Play
			source.start(0);
		} catch (error) {
			console.warn(`Failed to play sound ${soundId}:`, error);
		}
	}

	/**
	 * Play multiple sounds in quick succession (e.g., dice landing).
	 */
	async playSequence(
		sounds: Array<{
			id: SoundId;
			delay: number;
			options?: {
				volume?: number;
				pitch?: number;
				pan?: number;
			};
		}>,
	): Promise<void> {
		for (const { id, delay, options } of sounds) {
			if (delay > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
			await this.play(id, options);
		}
	}

	// =========================================================================
	// Volume Control
	// =========================================================================

	/**
	 * Set master volume.
	 */
	setMasterVolume(volume: number): void {
		this.#state.masterVolume = Math.max(0, Math.min(1, volume));
		if (this.#masterGain) {
			this.#masterGain.gain.value = this.#state.muted ? 0 : this.#state.masterVolume;
		}
	}

	/**
	 * Set category volume.
	 */
	setCategoryVolume(category: SoundCategory, volume: number): void {
		this.#state.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
		const gain = this.#categoryGains.get(category);
		if (gain) {
			gain.gain.value = this.#state.categoryVolumes[category];
		}
	}

	/**
	 * Toggle mute state.
	 */
	toggleMute(): boolean {
		this.#state.muted = !this.#state.muted;
		if (this.#masterGain) {
			this.#masterGain.gain.value = this.#state.muted ? 0 : this.#state.masterVolume;
		}
		return this.#state.muted;
	}

	/**
	 * Set mute state.
	 */
	setMuted(muted: boolean): void {
		this.#state.muted = muted;
		if (this.#masterGain) {
			this.#masterGain.gain.value = this.#state.muted ? 0 : this.#state.masterVolume;
		}
	}

	// =========================================================================
	// State Getters
	// =========================================================================

	get state(): Readonly<AudioState> {
		return { ...this.#state };
	}

	get isInitialized(): boolean {
		return this.#state.initialized;
	}

	get isSupported(): boolean {
		return this.#state.supported;
	}

	get isMuted(): boolean {
		return this.#state.muted;
	}

	get masterVolume(): number {
		return this.#state.masterVolume;
	}

	getCategoryVolume(category: SoundCategory): number {
		return this.#state.categoryVolumes[category];
	}

	// =========================================================================
	// Private Methods
	// =========================================================================

	async #loadSound(soundId: SoundId, cacheKey?: string): Promise<AudioBuffer | null> {
		const key = cacheKey ?? soundId;

		// Return cached buffer
		const cached = this.#buffers.get(key);
		if (cached) {
			return cached;
		}

		// Return in-flight promise
		const loading = this.#loadingPromises.get(key);
		if (loading) {
			return loading;
		}

		// Start loading
		const promise = this.#fetchAndDecodeSound(soundId, key);
		this.#loadingPromises.set(key, promise);

		try {
			const buffer = await promise;
			if (buffer) {
				this.#buffers.set(key, buffer);
			}
			return buffer;
		} finally {
			this.#loadingPromises.delete(key);
		}
	}

	async #fetchAndDecodeSound(soundId: SoundId, cacheKey: string): Promise<AudioBuffer | null> {
		if (!this.#context) {
			return null;
		}

		const config = SOUND_BANK[soundId];
		if (!config) {
			return null;
		}

		// Handle variant path
		let src = config.src;
		if (cacheKey !== soundId && config.variants) {
			const variant = cacheKey.split('_').pop();
			src = config.src.replace('.mp3', `_${variant}.mp3`);
		}

		try {
			const response = await fetch(src);
			if (!response.ok) {
				// Fallback to base sound if variant not found
				if (cacheKey !== soundId) {
					const fallbackResponse = await fetch(config.src);
					if (!fallbackResponse.ok) {
						console.warn(`Sound not found: ${src}`);
						return null;
					}
					const arrayBuffer = await fallbackResponse.arrayBuffer();
					return await this.#context.decodeAudioData(arrayBuffer);
				}
				console.warn(`Sound not found: ${src}`);
				return null;
			}

			const arrayBuffer = await response.arrayBuffer();
			return await this.#context.decodeAudioData(arrayBuffer);
		} catch (error) {
			console.warn(`Failed to load sound ${src}:`, error);
			return null;
		}
	}

	// =========================================================================
	// Cleanup
	// =========================================================================

	/**
	 * Clean up audio resources.
	 */
	destroy(): void {
		if (this.#context) {
			this.#context.close();
			this.#context = null;
		}
		// Clean up iOS silent audio workaround
		if (this.#silentAudio) {
			this.#silentAudio.pause();
			this.#silentAudio.src = '';
			this.#silentAudio = null;
		}
		this.#buffers.clear();
		this.#loadingPromises.clear();
		this.#masterGain = null;
		this.#categoryGains.clear();
		this.#state.initialized = false;
	}
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Global audio manager instance.
 */
export const audio = new AudioManager();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Initialize audio system.
 * Call after user interaction to comply with autoplay policies.
 */
export async function initAudio(): Promise<boolean> {
	return audio.init();
}

/**
 * Play a sound.
 */
export async function playSound(
	soundId: SoundId,
	options?: Parameters<typeof audio.play>[1],
): Promise<void> {
	return audio.play(soundId, options);
}

/**
 * Check if audio is supported.
 */
export function isAudioSupported(): boolean {
	return audio.isSupported;
}

/**
 * Get current audio state.
 */
export function getAudioState(): AudioState {
	return audio.state;
}
