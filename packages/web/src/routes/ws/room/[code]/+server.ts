/**
 * WebSocket Proxy: /ws/room/[code] → GameRoom Durable Object
 *
 * Proxies WebSocket connections from the Pages frontend to the
 * GameRoom DO via Service Binding. This enables same-origin
 * WebSocket connections without CORS.
 *
 * The Service Binding (GAME_WORKER) provides zero-latency RPC
 * to the gamelobby Worker.
 *
 * Auth: Token passed via query param (cookies unreliable for CF WebSocket)
 */

import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform, url }) => {
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

	// Get token from query param (cookies unreliable for WebSocket on CF)
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response('Authentication required', { status: 401 });
	}

	// Validate the token and get user info
	const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		console.error('[ws/room] Token validation failed:', error?.message);
		return new Response('Invalid token', { status: 401 });
	}

	// Build headers with user info
	const headers = new Headers(request.headers);
	headers.set('X-User-Id', user.id);

	// Use display name from metadata, or email prefix, or Guest
	const displayName =
		(user.user_metadata?.display_name as string) ||
		(user.user_metadata?.full_name as string) ||
		user.email?.split('@')[0] ||
		'Guest';
	headers.set('X-Display-Name', displayName);
	headers.set('X-Avatar-Seed', user.id);
	headers.set('Authorization', `Bearer ${token}`);

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
