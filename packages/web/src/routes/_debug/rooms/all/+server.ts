/**
 * Debug API Proxy: /_debug/rooms/all → GlobalLobby /_debug/rooms/all
 *
 * DELETE - Clear ALL rooms (nuclear option).
 * Requires admin+ role for access.
 */

import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ platform, locals }) => {
	// Check authentication
	const { user } = await locals.safeGetSession();
	if (!user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const gameWorker = platform?.env?.GAME_WORKER;

	if (!gameWorker) {
		console.error('[_debug/rooms/all] GAME_WORKER service binding not available');
		return new Response(JSON.stringify({ error: 'Service unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Proxy to GlobalLobby debug endpoint
	const response = await gameWorker.fetch(
		new Request('https://internal/_debug/rooms/all', {
			method: 'DELETE',
		}),
	);

	return new Response(response.body, {
		status: response.status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
};
