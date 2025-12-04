import { error } from '@sveltejs/kit';
import { getProfile } from '$lib/supabase/profiles';
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

	// Get or create profile
	const { data: profile, error: profileError } = await getProfile(locals.supabase, user.id);

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
