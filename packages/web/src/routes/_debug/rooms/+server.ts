/**
 * Debug API Proxy: /_debug/rooms → GlobalLobby /_debug/rooms
 *
 * Returns the list of active rooms from the GlobalLobby DO.
 * Requires moderator+ role for access.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals }) => {
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
		console.error('[_debug/rooms] GAME_WORKER service binding not available');
		return new Response(JSON.stringify({ error: 'Service unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Proxy to GlobalLobby debug endpoint
	const response = await gameWorker.fetch(new Request('https://internal/_debug/rooms'));

	return new Response(response.body, {
		status: response.status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache, max-age=0',
		},
	});
};
