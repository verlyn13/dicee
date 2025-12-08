import { error } from '@sveltejs/kit';
import { createProfile, getProfile } from '$lib/supabase/profiles';
import type { PageServerLoad } from './$types';

/**
 * Profile page server load
 *
 * Loads the current user's profile data.
 * Creates a profile if one doesn't exist yet.
 */
export const load = (async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		// This shouldn't happen due to the layout guard, but handle it anyway
		throw error(401, 'Unauthorized');
	}

	// Try to get existing profile
	let { data: profile, error: profileError } = await getProfile(locals.supabase, user.id);

	// If profile doesn't exist, create it (handles cases where trigger didn't run)
	if (!profile && !profileError) {
		const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || null;
		const { data: newProfile, error: createError } = await createProfile(locals.supabase, user.id, {
			display_name: displayName,
			is_anonymous: user.is_anonymous ?? false,
		});

		if (createError) {
			console.error('Failed to create profile:', createError);
			throw error(500, 'Failed to create profile');
		}

		profile = newProfile;
	}

	if (profileError) {
		console.error('Failed to load profile:', profileError);
		throw error(500, 'Failed to load profile');
	}

	if (!profile) {
		throw error(404, 'Profile not found');
	}

	return {
		profile,
	};
}) satisfies PageServerLoad;
