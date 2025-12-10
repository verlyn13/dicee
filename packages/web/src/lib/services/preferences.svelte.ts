/**
 * Preferences Service
 *
 * Handles sync between localStorage and Supabase for user preferences.
 * - Anonymous users: localStorage only
 * - Authenticated users: localStorage + Supabase sync
 *
 * Uses Svelte 5 runes for reactive state.
 */

import {
	DEFAULT_PREFERENCES,
	mergePreferences,
	parsePreferences,
	type UserPreferences,
} from '@dicee/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/types/database';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'dicee_user_preferences';
const SYNC_DEBOUNCE_MS = 500;

// =============================================================================
// Preferences Service Class
// =============================================================================

class PreferencesService {
	// Private state
	#preferences = $state<UserPreferences>(DEFAULT_PREFERENCES);
	#initialized = $state(false);
	#syncing = $state(false);
	#supabase: SupabaseClient<Database> | null = null;
	#userId: string | null = null;
	#syncTimeout: ReturnType<typeof setTimeout> | null = null;

	// ==========================================================================
	// Public Getters
	// ==========================================================================

	/**
	 * Current preferences (reactive)
	 */
	get preferences(): UserPreferences {
		return this.#preferences;
	}

	/**
	 * Whether the service has been initialized
	 */
	get initialized(): boolean {
		return this.#initialized;
	}

	/**
	 * Whether a sync to Supabase is in progress
	 */
	get syncing(): boolean {
		return this.#syncing;
	}

	// ==========================================================================
	// Initialization
	// ==========================================================================

	/**
	 * Initialize the preferences service.
	 * Call this once on app startup.
	 */
	init(): void {
		if (this.#initialized) return;

		// Load from localStorage
		this.#loadFromLocalStorage();
		this.#initialized = true;
	}

	/**
	 * Set the Supabase client for remote sync.
	 * Call this when auth is initialized.
	 */
	setSupabase(supabase: SupabaseClient<Database>): void {
		this.#supabase = supabase;
	}

	// ==========================================================================
	// Auth State Handlers
	// ==========================================================================

	/**
	 * Handle user login.
	 * Syncs preferences between local and remote.
	 */
	async onLogin(userId: string): Promise<void> {
		if (!this.#supabase) {
			console.warn('[preferences] Supabase not initialized, skipping sync');
			return;
		}

		this.#userId = userId;
		this.#syncing = true;

		try {
			const local = this.#preferences;
			const remote = await this.#fetchFromSupabase(userId);

			if (!remote || !remote._version) {
				// FIRST LOGIN: user has no remote preferences - seed from local
				await this.#saveToSupabase(userId, local);
			} else {
				// RETURNING USER: merge and apply
				const merged = mergePreferences(local, remote);
				this.#preferences = merged;
				this.#saveToLocalStorage(merged);
				await this.#saveToSupabase(userId, merged);
			}
		} catch (error) {
			console.error('[preferences] Sync on login failed:', error);
			// Keep using local preferences - don't block on sync failure
		} finally {
			this.#syncing = false;
		}
	}

	/**
	 * Handle user logout.
	 * Stops syncing but keeps local preferences.
	 */
	onLogout(): void {
		this.#userId = null;
		this.#cancelPendingSync();
		// Keep local preferences for anonymous session
	}

	// ==========================================================================
	// Preference Updates
	// ==========================================================================

	/**
	 * Update preferences.
	 * Saves to localStorage immediately, debounces Supabase sync.
	 */
	update(updates: Partial<UserPreferences['audio']> & Partial<UserPreferences['haptics']>): void {
		// Merge updates into current preferences
		const newPrefs: UserPreferences = {
			...this.#preferences,
			audio: {
				...this.#preferences.audio,
				...(updates.masterVolume !== undefined && { masterVolume: updates.masterVolume }),
				...(updates.muted !== undefined && { muted: updates.muted }),
			},
			haptics: {
				...this.#preferences.haptics,
				...(updates.enabled !== undefined && { enabled: updates.enabled }),
			},
		};

		this.#preferences = newPrefs;

		// Save to localStorage immediately
		this.#saveToLocalStorage(newPrefs);

		// Debounce sync to Supabase if authenticated
		if (this.#userId && this.#supabase) {
			this.#debouncedSync(newPrefs);
		}
	}

	/**
	 * Update master volume (0-100)
	 */
	setMasterVolume(volume: number): void {
		this.update({ masterVolume: Math.max(0, Math.min(100, volume)) });
	}

	/**
	 * Toggle mute state
	 */
	setMuted(muted: boolean): void {
		this.update({ muted });
	}

	/**
	 * Toggle haptics
	 */
	setHapticsEnabled(enabled: boolean): void {
		this.update({ enabled });
	}

	/**
	 * Reset all preferences to defaults.
	 * Saves to both local and remote.
	 */
	async reset(): Promise<void> {
		this.#preferences = DEFAULT_PREFERENCES;
		this.#saveToLocalStorage(DEFAULT_PREFERENCES);

		if (this.#userId && this.#supabase) {
			this.#cancelPendingSync();
			try {
				await this.#saveToSupabase(this.#userId, DEFAULT_PREFERENCES);
			} catch (error) {
				console.error('[preferences] Reset sync failed:', error);
			}
		}
	}

	// ==========================================================================
	// Private Methods - localStorage
	// ==========================================================================

	#loadFromLocalStorage(): void {
		if (typeof localStorage === 'undefined') return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			this.#preferences = parsePreferences(stored);
		} catch {
			this.#preferences = DEFAULT_PREFERENCES;
		}
	}

	#saveToLocalStorage(prefs: UserPreferences): void {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		} catch {
			// Ignore storage errors (quota exceeded, etc.)
		}
	}

	// ==========================================================================
	// Private Methods - Supabase
	// ==========================================================================

	async #fetchFromSupabase(userId: string): Promise<UserPreferences | null> {
		if (!this.#supabase) return null;

		const { data, error } = await this.#supabase
			.from('profiles')
			.select('preferences')
			.eq('id', userId)
			.single();

		if (error) {
			// PGRST116 = "No rows returned" - profile doesn't exist yet
			if (error.code === 'PGRST116') {
				return null;
			}
			throw new Error(`Failed to fetch preferences: ${error.message}`);
		}

		// Parse and validate the preferences
		return parsePreferences(data?.preferences);
	}

	async #saveToSupabase(userId: string, prefs: UserPreferences): Promise<void> {
		if (!this.#supabase) return;

		const { error } = await this.#supabase
			.from('profiles')
			.update({ preferences: prefs as unknown as Json })
			.eq('id', userId);

		if (error) {
			throw new Error(`Failed to save preferences: ${error.message}`);
		}
	}

	// ==========================================================================
	// Private Methods - Debouncing
	// ==========================================================================

	#debouncedSync(prefs: UserPreferences): void {
		this.#cancelPendingSync();

		this.#syncTimeout = setTimeout(async () => {
			if (!this.#userId || !this.#supabase) return;

			this.#syncing = true;
			try {
				await this.#saveToSupabase(this.#userId, prefs);
			} catch (error) {
				console.error('[preferences] Debounced sync failed:', error);
			} finally {
				this.#syncing = false;
			}
		}, SYNC_DEBOUNCE_MS);
	}

	#cancelPendingSync(): void {
		if (this.#syncTimeout) {
			clearTimeout(this.#syncTimeout);
			this.#syncTimeout = null;
		}
	}

	// ==========================================================================
	// Testing Interface
	// ==========================================================================

	/**
	 * Testing interface - DO NOT USE IN PRODUCTION CODE
	 */
	__testing = {
		reset: () => {
			this.#preferences = DEFAULT_PREFERENCES;
			this.#initialized = false;
			this.#syncing = false;
			this.#supabase = null;
			this.#userId = null;
			this.#cancelPendingSync();
		},
		setPreferences: (prefs: UserPreferences) => {
			this.#preferences = prefs;
		},
	};
}

// =============================================================================
// Singleton Export
// =============================================================================

export const preferencesService = new PreferencesService();
