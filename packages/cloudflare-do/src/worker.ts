/**
 * Cloudflare Worker Entry Point
 *
 * Routes requests to the GameRoom Durable Object based on room code.
 */

import { GameRoom } from './GameRoom';
import type { Env } from './types';

// Export the Durable Object class for Cloudflare
export { GameRoom };

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Health check endpoint
		if (url.pathname === '/health') {
			return new Response('OK', { status: 200 });
		}

		// Room routing: /room/:roomCode
		// Room codes are 6 uppercase alphanumeric characters
		const roomMatch = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/i);
		if (!roomMatch) {
			return new Response('Not Found', { status: 404 });
		}

		const roomCode = roomMatch[1].toUpperCase();

		// Get or create Durable Object instance by room code
		// idFromName creates a deterministic ID - same code = same instance
		const id = env.GAME_ROOM.idFromName(roomCode);
		const stub = env.GAME_ROOM.get(id);

		// Forward request to Durable Object
		return stub.fetch(request);
	},
};
