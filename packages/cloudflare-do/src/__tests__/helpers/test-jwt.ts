/**
 * Test JWT Helper
 *
 * Creates mock JWT tokens for integration testing.
 * Uses HMAC signing since we can't use real Supabase JWKS in tests.
 */

import * as jose from 'jose';

const TEST_SECRET = new TextEncoder().encode('test-secret-key-for-integration-tests-only');

/**
 * Create a mock JWT token for testing
 */
export async function createTestJWT(payload: {
	sub: string;
	email?: string;
	displayName?: string;
	avatarUrl?: string;
}): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const claims = {
		sub: payload.sub,
		email: payload.email ?? `${payload.sub}@test.example.com`,
		user_metadata: {
			display_name: payload.displayName ?? `Test User ${payload.sub}`,
			avatar_url: payload.avatarUrl ?? null,
		},
		aud: 'authenticated',
		role: 'authenticated',
		iat: now,
		exp: now + 3600, // 1 hour
	};

	const jwt = await new jose.SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(TEST_SECRET);

	return jwt;
}

/**
 * Create an expired JWT for testing error handling
 */
export async function createExpiredJWT(sub: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const claims = {
		sub,
		email: `${sub}@test.example.com`,
		user_metadata: { display_name: `Test User ${sub}` },
		aud: 'authenticated',
		role: 'authenticated',
		iat: now - 7200, // 2 hours ago
		exp: now - 3600, // Expired 1 hour ago
	};

	const jwt = await new jose.SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(TEST_SECRET);

	return jwt;
}

/**
 * Get the test secret for verifying tokens in mock auth
 */
export function getTestSecret(): Uint8Array {
	return TEST_SECRET;
}
