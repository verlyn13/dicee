/**
 * REST API Proxy: /api/lobby/rooms → GlobalLobby /lobby/rooms
 *
 * Returns the list of public game rooms from the GlobalLobby DO.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const gameWorker = platform?.env?.GAME_WORKER;

	if (!gameWorker) {
		console.error('[api/lobby/rooms] GAME_WORKER service binding not available');
		return new Response(JSON.stringify({ error: 'Service unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Proxy to GlobalLobby REST endpoint
	const response = await gameWorker.fetch(new Request('https://internal/lobby/rooms'));

	// Return the response with appropriate headers
	return new Response(response.body, {
		status: response.status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache',
		},
	});
};
