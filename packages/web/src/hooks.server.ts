import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/supabase/server';

export const handle: Handle = async ({ event, resolve }) => {
	// Create a Supabase client for this request
	event.locals.supabase = createSupabaseServerClient(event);

	/**
	 * Safe session getter that validates the JWT.
	 *
	 * CRITICAL: Never use supabase.auth.getSession() directly on the server.
	 * It doesn't validate the JWT signature and can be spoofed.
	 * Always use getUser() which validates the JWT against Supabase's public keys.
	 */
	event.locals.safeGetSession = async () => {
		// First get the session (for the session object itself)
		const {
			data: { session },
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		// CRITICAL: Validate the JWT by calling getUser()
		// This makes a request to Supabase to verify the token
		const {
			data: { user },
			error,
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			// JWT validation failed - treat as unauthenticated
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Allow Supabase-specific headers to be serialized
			return name === 'content-range' || name === 'x-supabase-api-version';
		},
	});
};
