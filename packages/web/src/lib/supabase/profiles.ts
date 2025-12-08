import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesUpdate } from '$lib/types/database';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

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

	return { data, error: null };
}

/**
 * Create or upsert a profile for a user
 * Note: Profiles are auto-created by trigger on auth.users insert,
 * but this can be used to ensure a profile exists or update initial values
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
