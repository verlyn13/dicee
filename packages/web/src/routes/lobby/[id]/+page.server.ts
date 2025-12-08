import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect /lobby/[id] → /games/dicee/room/[id]
 */
export const load: PageServerLoad = ({ params }) => {
	redirect(301, `/games/dicee/room/${params.id?.toUpperCase()}`);
};
