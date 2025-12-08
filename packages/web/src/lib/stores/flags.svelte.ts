import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { FeatureFlag } from '$lib/supabase/flags';
import { getAllFlags, subscribeToFlags } from '$lib/supabase/flags';
import type { Database } from '$lib/types/database';

/**
 * User context for flag evaluation
 */
export interface FlagUserContext {
	userId: string | null;
	gamesPlayed: number;
	isPremium: boolean;
}

/**
 * Feature flag IDs - type-safe access
 */
export type FlagId =
	| 'ev_display'
	| 'coach_mode'
	| 'post_game_analysis'
	| 'audio_system'
	| 'enhanced_animations'
	| 'reactions'
	| 'spectator_mode'
	| 'gallery_predictions'
	| 'skill_rating'
	| 'advanced_stats';

/**
 * Simple hash function for deterministic percentage rollout
 * Uses FNV-1a algorithm for good distribution
 */
function simpleHash(str: string): number {
	let hash = 2166136261; // FNV offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
	}
	return hash;
}

/**
 * Feature Flags Store using Svelte 5 runes
 *
 * Manages feature flag state with:
 * - User targeting via explicit allowlist
 * - Premium gates
 * - Games-played gates
 * - Percentage rollout with deterministic hash
 * - Realtime updates via Supabase subscription
 */
class FlagStore {
	// Private state
	#flags = $state<Map<string, FeatureFlag>>(new Map());
	#userContext = $state<FlagUserContext>({
		userId: null,
		gamesPlayed: 0,
		isPremium: false,
	});
	#loading = $state(true);
	#initialized = $state(false);
	#realtimeChannel = $state<RealtimeChannel | null>(null);

	// Public getters
	get loading() {
		return this.#loading;
	}
	get initialized() {
		return this.#initialized;
	}

	/**
	 * Initialize the flags store
	 * Call once after auth is initialized
	 */
	async init(supabase: SupabaseClient<Database>): Promise<void> {
		if (this.#initialized) return;

		this.#loading = true;

		try {
			// Fetch all flags
			const { data, error } = await getAllFlags(supabase);
			if (error) {
				console.error('[flags] Failed to load feature flags:', error);
			} else if (data) {
				this.#flags = new Map(data.map((f) => [f.id, f]));
			}

			// Subscribe to realtime updates
			this.#realtimeChannel = subscribeToFlags(supabase, (updatedFlags) => {
				this.#flags = new Map(updatedFlags.map((f) => [f.id, f]));
			});

			this.#initialized = true;
		} finally {
			this.#loading = false;
		}
	}

	/**
	 * Update user context for flag evaluation
	 * Call when user logs in or stats change
	 */
	setUserContext(context: Partial<FlagUserContext>): void {
		this.#userContext = {
			...this.#userContext,
			...context,
		};
	}

	/**
	 * Check if a feature flag is enabled for the current user
	 *
	 * Evaluation order:
	 * 1. If flag doesn't exist or is globally disabled → false
	 * 2. If user is in explicit allowlist → true
	 * 3. If premium_only and user not premium → false
	 * 4. If min_games_played not met → false
	 * 5. If rollout_percent < 100, use deterministic hash
	 * 6. Otherwise → true
	 */
	isEnabled(flagId: FlagId): boolean {
		const flag = this.#flags.get(flagId);

		// Flag doesn't exist or is globally disabled
		if (!flag?.enabled) {
			return false;
		}

		const { userId, gamesPlayed, isPremium } = this.#userContext;

		// Explicit user allowlist (beta testers, etc.)
		if (userId && flag.user_ids?.includes(userId)) {
			return true;
		}

		// Premium gate
		if (flag.premium_only && !isPremium) {
			return false;
		}

		// Games played gate
		if (flag.min_games_played > 0 && gamesPlayed < flag.min_games_played) {
			return false;
		}

		// Percentage rollout
		if (flag.rollout_percent < 100) {
			// No user = can't do percentage rollout, default to disabled
			if (!userId) {
				return false;
			}

			// Deterministic hash ensures same user gets same result
			const hashInput = userId + flagId;
			const hash = simpleHash(hashInput) % 100;
			if (hash >= flag.rollout_percent) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get flag metadata (useful for admin/debug views)
	 */
	getFlag(flagId: FlagId): FeatureFlag | undefined {
		return this.#flags.get(flagId);
	}

	/**
	 * Get all flags (useful for admin views)
	 */
	getAllFlags(): FeatureFlag[] {
		return Array.from(this.#flags.values());
	}

	/**
	 * Cleanup - call when store is no longer needed
	 */
	async destroy(): Promise<void> {
		if (this.#realtimeChannel) {
			await this.#realtimeChannel.unsubscribe();
			this.#realtimeChannel = null;
		}
		this.#flags.clear();
		this.#initialized = false;
	}

	/**
	 * Testing interface - DO NOT USE IN PRODUCTION CODE
	 */
	__testing = {
		setFlags: (flags: FeatureFlag[]) => {
			this.#flags = new Map(flags.map((f) => [f.id, f]));
		},
		setUserContext: (context: FlagUserContext) => {
			this.#userContext = context;
		},
		setInitialized: (value: boolean) => {
			this.#initialized = value;
		},
		reset: () => {
			this.#flags.clear();
			this.#userContext = { userId: null, gamesPlayed: 0, isPremium: false };
			this.#loading = true;
			this.#initialized = false;
		},
	};
}

// Singleton export for global access
export const flags = new FlagStore();
