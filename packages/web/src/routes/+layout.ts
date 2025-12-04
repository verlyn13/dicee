import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from '$lib/types/database';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	/**
	 * Declare a dependency on supabase:auth.
	 * This allows calling `invalidate('supabase:auth')` to re-run this load function
	 * when auth state changes.
	 */
	depends('supabase:auth');

	// Create a browser client for client-side operations
	// On the server, we use the client from hooks.server.ts via locals
	const supabase = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { fetch },
	});

	// Use session data from server (already validated by safeGetSession)
	// On client, also check for updates
	let session = data.session;
	let user = data.user;

	if (isBrowser()) {
		// On client, sync with current auth state
		const { data: authData } = await supabase.auth.getSession();
		session = authData.session;
		user = authData.session?.user ?? null;
	}

	return {
		session,
		user,
		supabase,
	};
};
