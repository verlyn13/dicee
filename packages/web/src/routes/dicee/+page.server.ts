import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect /dicee → /games/dicee
 */
export const load: PageServerLoad = () => {
	redirect(301, '/games/dicee');
};
