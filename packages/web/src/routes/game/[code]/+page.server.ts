import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect /game/[code] → /games/dicee/room/[code]
 */
export const load: PageServerLoad = ({ params }) => {
	redirect(301, `/games/dicee/room/${params.code}`);
};
