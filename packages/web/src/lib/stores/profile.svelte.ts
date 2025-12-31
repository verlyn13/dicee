import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminRole, Profile } from '$lib/supabase/profiles';
import { getProfile, hasRolePrivilege, isAdmin, isSuperAdmin } from '$lib/supabase/profiles';
import type { Database } from '$lib/types/database';
import { createServiceLogger } from '$lib/utils/logger';

const log = createServiceLogger('ProfileStore');

/**
 * Profile state store using Svelte 5 runes.
 *
 * Manages the current user's profile data including admin role.
 * Separate from auth store since profile data lives in a different table.
 */
class ProfileState {
	// Private state
	#supabase = $state<SupabaseClient<Database> | null>(null);
	#profile = $state<Profile | null>(null);
	#loading = $state(false);
	#initialized = $state(false);
	#error = $state<string | null>(null);

	// Derived state - readonly externally
	readonly role = $derived<AdminRole>(this.#profile?.role ?? 'user');
	readonly isAdmin = $derived(isAdmin(this.#profile?.role));
	readonly isSuperAdmin = $derived(isSuperAdmin(this.#profile?.role));
	readonly isModerator = $derived(hasRolePrivilege(this.#profile?.role, 'moderator'));
	readonly displayName = $derived(this.#profile?.display_name ?? null);
	readonly avatarSeed = $derived(this.#profile?.avatar_seed ?? null);

	// Public getters
	get profile() {
		return this.#profile;
	}
	get loading() {
		return this.#loading;
	}
	get initialized() {
		return this.#initialized;
	}
	get error() {
		return this.#error;
	}

	/**
	 * Initialize the profile store with Supabase client.
	 * Call this once in +layout.svelte after auth is initialized.
	 */
	init(supabase: SupabaseClient<Database>) {
		this.#supabase = supabase;
	}

	/**
	 * Load profile for a user ID.
	 * Call this after auth initialization with the user ID.
	 */
	async loadProfile(userId: string): Promise<void> {
		if (!this.#supabase) {
			this.#error = 'Supabase not initialized';
			log.warn('loadProfile failed: Supabase not initialized');
			return;
		}

		log.debug('loadProfile starting', { userId });
		this.#loading = true;
		this.#error = null;

		try {
			const { data, error } = await getProfile(this.#supabase, userId);

			if (error) {
				log.error('loadProfile error', { message: error.message });
				this.#error = error.message;
				this.#profile = null;
			} else {
				log.debug('loadProfile success', {
					id: data?.id,
					role: data?.role,
					displayName: data?.display_name,
				});
				this.#profile = data;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Unknown error loading profile';
			log.error('loadProfile exception', { message: errorMsg });
			this.#error = errorMsg;
			this.#profile = null;
		} finally {
			this.#loading = false;
			this.#initialized = true;
			log.debug('loadProfile complete', {
				initialized: this.#initialized,
				hasProfile: !!this.#profile,
				role: this.#profile?.role,
			});
		}
	}

	/**
	 * Refresh the current profile from database.
	 * Use after profile updates.
	 */
	async refresh(): Promise<void> {
		if (!this.#profile?.id) return;
		await this.loadProfile(this.#profile.id);
	}

	/**
	 * Clear profile state (e.g., on sign out).
	 */
	clear(): void {
		this.#profile = null;
		this.#error = null;
		this.#initialized = false;
	}

	/**
	 * Check if the current user has a specific permission.
	 * For real-time checks, use the database function via hasAdminPermission().
	 * This is a quick client-side check based on role.
	 */
	hasPermission(permission: string): boolean {
		const role = this.#profile?.role;
		if (!role) return false;

		// Super admin has all permissions
		if (role === 'super_admin') return true;

		// Map common permissions to roles
		const rolePermissions: Record<AdminRole, readonly string[]> = {
			user: [],
			moderator: ['rooms:view', 'rooms:close', 'chat:moderate'],
			admin: [
				'rooms:view',
				'rooms:close',
				'rooms:clear_all',
				'chat:moderate',
				'chat:delete',
				'users:view',
				'users:ban',
				'audit:view',
			],
			super_admin: ['*'],
		};

		const perms = rolePermissions[role] ?? [];
		return perms.includes('*') || perms.includes(permission);
	}

	/**
	 * Testing interface - DO NOT USE IN PRODUCTION CODE
	 */
	__testing = {
		setProfile: (profile: Profile | null) => {
			this.#profile = profile;
		},
		setLoading: (loading: boolean) => {
			this.#loading = loading;
		},
		setInitialized: (initialized: boolean) => {
			this.#initialized = initialized;
		},
		reset: () => {
			this.#supabase = null;
			this.#profile = null;
			this.#loading = false;
			this.#initialized = false;
			this.#error = null;
		},
	};
}

// Singleton export for global access
export const profileStore = new ProfileState();
