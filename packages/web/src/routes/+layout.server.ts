import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Use safeGetSession which validates the JWT
	const { session, user } = await locals.safeGetSession();

	return {
		session,
		user,
	};
};
