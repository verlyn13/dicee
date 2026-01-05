/**
 * REST API Proxy: /api/transcribe → GAME_WORKER /api/transcribe
 *
 * Proxies audio transcription requests to the Cloudflare Workers AI endpoint.
 */

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const gameWorker = platform?.env?.GAME_WORKER;

	if (!gameWorker) {
		console.error('[api/transcribe] GAME_WORKER service binding not available');
		return new Response(JSON.stringify({ error: 'Service unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		// Get the request body
		const body = await request.text();

		// Proxy to GAME_WORKER transcription endpoint
		const response = await gameWorker.fetch(
			new Request('https://internal/api/transcribe', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body,
			}),
		);

		// Return the response
		return new Response(response.body, {
			status: response.status,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	} catch (error) {
		console.error('[api/transcribe] Proxy error:', error);
		return new Response(JSON.stringify({ error: 'Transcription failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
