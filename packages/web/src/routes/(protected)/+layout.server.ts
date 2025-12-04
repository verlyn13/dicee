import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Protected route layout - requires authentication
 *
 * This layout guards all routes under (protected) by checking for a valid session.
 * If the user is not authenticated, they are redirected to the home page.
 */
export const load = (async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	// Redirect to home if not authenticated
	if (!session || !user) {
		throw redirect(303, `/?redirect=${encodeURIComponent(url.pathname)}`);
	}

	return {
		session,
		user,
	};
}) satisfies LayoutServerLoad;
