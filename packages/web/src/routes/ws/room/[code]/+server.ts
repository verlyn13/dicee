/**
 * WebSocket Proxy: /ws/room/[code] → GameRoom Durable Object
 *
 * Proxies WebSocket connections from the Pages frontend to the
 * GameRoom DO via Service Binding. This enables same-origin
 * WebSocket connections without CORS.
 *
 * The Service Binding (GAME_WORKER) provides zero-latency RPC
 * to the gamelobby Worker.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform, locals }) => {
	const { code } = params;
	const gameWorker = platform?.env?.GAME_WORKER;

	if (!gameWorker) {
		console.error('[ws/room] GAME_WORKER service binding not available');
		return new Response('Service unavailable - GAME_WORKER binding missing', { status: 503 });
	}

	// Validate room code format (6 uppercase alphanumeric)
	if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
		return new Response('Invalid room code format', { status: 400 });
	}

	// Build headers with user info from session
	const headers = new Headers(request.headers);

	// Get user info from Supabase session
	const { session, user } = await locals.safeGetSession();

	if (user) {
		headers.set('X-User-Id', user.id);
		// Use display name from metadata, or email prefix, or Guest
		const displayName =
			(user.user_metadata?.display_name as string) ||
			(user.user_metadata?.full_name as string) ||
			user.email?.split('@')[0] ||
			'Guest';
		headers.set('X-Display-Name', displayName);
		headers.set('X-Avatar-Seed', user.id);
	}

	// Add access token (required for game room authentication)
	if (session?.access_token) {
		headers.set('Authorization', `Bearer ${session.access_token}`);
	} else {
		// Game rooms require authentication
		return new Response('Authentication required', { status: 401 });
	}

	// Proxy to the GameRoom DO via service binding
	const proxyRequest = new Request(
		new URL(`/room/${code.toUpperCase()}`, 'https://internal').toString(),
		{
			method: request.method,
			headers,
			body: request.body,
			// @ts-expect-error - duplex required for streaming bodies
			duplex: 'half',
		},
	);

	return gameWorker.fetch(proxyRequest);
};
