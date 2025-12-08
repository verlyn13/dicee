import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect /lobby → / (landing page is now the lobby)
 */
export const load: PageServerLoad = () => {
	redirect(301, '/');
};
