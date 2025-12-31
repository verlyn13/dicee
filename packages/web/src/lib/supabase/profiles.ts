import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesUpdate } from '$lib/types/database';
import { createServiceLogger } from '$lib/utils/logger';

const log = createServiceLogger('Profiles');

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

/** Admin role from database enum */
export type AdminRole = Database['public']['Enums']['admin_role'];

/** Admin permission record */
export type AdminPermission = Tables<'admin_permissions'>;

/** Admin audit log entry */
export type AdminAuditLog = Tables<'admin_audit_log'>;

/**
 * Get a user's profile by ID
 * Returns null data (not an error) if profile doesn't exist
 */
export async function getProfile(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: Profile | null; error: Error | null }> {
	const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

	if (error) {
		// PGRST116 = "No rows returned" - this is not a real error, just means profile doesn't exist
		if (error.code === 'PGRST116') {
			return { data: null, error: null };
		}
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Update a user's profile
 * Only the profile owner can update their own profile (enforced by RLS)
 *
 * Also syncs display_name to auth.users.user_metadata so JWT tokens
 * contain the correct display name for multiplayer games.
 */
export async function updateProfile(
	supabase: SupabaseClient<Database>,
	userId: string,
	updates: ProfileUpdate,
): Promise<{ data: Profile | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('profiles')
		.update(updates)
		.eq('id', userId)
		.select()
		.single();

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	// Sync display_name to auth user metadata so JWT contains it
	// This ensures multiplayer games show the correct display name
	if (updates.display_name !== undefined && supabase.auth?.updateUser) {
		try {
			const { error: authError } = await supabase.auth.updateUser({
				data: { display_name: updates.display_name },
			});

			if (authError) {
				// Log but don't fail - profile update succeeded
				log.warn('Failed to sync display_name to auth metadata', { error: authError.message });
			}
		} catch {
			// Silently ignore if auth.updateUser is not available (e.g., in tests)
		}
	}

	return { data, error: null };
}

/**
 * Create or upsert a profile for a user
 * Note: Profiles are auto-created by trigger on auth.users insert,
 * but this can be used to ensure a profile exists or update initial values
 *
 * Also syncs display_name to auth.users.user_metadata if provided.
 */
export async function createProfile(
	supabase: SupabaseClient<Database>,
	userId: string,
	profileData?: Partial<ProfileUpdate>,
): Promise<{ data: Profile | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('profiles')
		.upsert(
			{
				id: userId,
				...profileData,
			},
			{ onConflict: 'id' },
		)
		.select()
		.single();

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	// Sync display_name to auth user metadata so JWT contains it
	if (profileData?.display_name !== undefined && supabase.auth?.updateUser) {
		try {
			const { error: authError } = await supabase.auth.updateUser({
				data: { display_name: profileData.display_name },
			});

			if (authError) {
				log.warn('Failed to sync display_name to auth metadata', { error: authError.message });
			}
		} catch {
			// Silently ignore if auth.updateUser is not available (e.g., in tests)
		}
	}

	return { data, error: null };
}

/**
 * Get multiple profiles by user IDs
 * Useful for fetching opponent profiles in game history
 */
export async function getProfiles(
	supabase: SupabaseClient<Database>,
	userIds: string[],
): Promise<{ data: Profile[] | null; error: Error | null }> {
	const { data, error } = await supabase.from('profiles').select('*').in('id', userIds);

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Update user's last_seen_at timestamp
 * Called periodically to track user activity
 */
export async function updateLastSeen(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ error: Error | null }> {
	const { error } = await supabase
		.from('profiles')
		.update({ last_seen_at: new Date().toISOString() })
		.eq('id', userId);

	if (error) {
		return { error: new Error(error.message) };
	}

	return { error: null };
}

// =============================================================================
// Admin Functions
// =============================================================================

/**
 * Check if a user has a specific admin permission
 * Uses the database function which supports wildcard permissions
 */
export async function hasAdminPermission(
	supabase: SupabaseClient<Database>,
	userId: string,
	permission: string,
): Promise<{ data: boolean; error: Error | null }> {
	const { data, error } = await supabase.rpc('has_admin_permission', {
		user_id: userId,
		perm: permission,
	});

	if (error) {
		return { data: false, error: new Error(error.message) };
	}

	return { data: data ?? false, error: null };
}

/**
 * Get a user's admin role
 */
export async function getUserRole(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: AdminRole | null; error: Error | null }> {
	const { data, error } = await supabase.rpc('get_user_role', {
		user_id: userId,
	});

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: string[] | null; error: Error | null }> {
	const { data, error } = await supabase.rpc('get_user_permissions', {
		user_id: userId,
	});

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data: data?.map((p) => p.permission) ?? [], error: null };
}

/**
 * Check if a user has any admin privileges (not just 'user' role)
 */
export function isAdmin(role: AdminRole | undefined | null): boolean {
	return role === 'moderator' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(role: AdminRole | undefined | null): boolean {
	return role === 'super_admin';
}

/**
 * Admin role hierarchy for comparison
 */
export const ADMIN_ROLE_HIERARCHY: Record<AdminRole, number> = {
	user: 0,
	moderator: 1,
	admin: 2,
	super_admin: 3,
};

/**
 * Check if roleA has at least the privileges of roleB
 */
export function hasRolePrivilege(roleA: AdminRole | undefined | null, roleB: AdminRole): boolean {
	if (!roleA) return false;
	return ADMIN_ROLE_HIERARCHY[roleA] >= ADMIN_ROLE_HIERARCHY[roleB];
}
