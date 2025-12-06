/**
 * JWKS-based JWT Authentication
 *
 * Verifies Supabase JWTs using the public JWKS endpoint.
 * No API calls needed - asymmetric key verification only.
 */

import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verified JWT claims from Supabase
 */
export interface SupabaseJWTClaims extends JWTPayload {
	/** User ID (UUID) */
	sub: string;
	/** User email (if available) */
	email?: string;
	/** Authentication assurance level */
	aal?: string;
	/** User role (authenticated, anon) */
	role?: string;
	/** User metadata from auth */
	user_metadata?: {
		display_name?: string;
		avatar_url?: string;
		[key: string]: unknown;
	};
}

/**
 * Result of JWT verification
 */
export type VerifyResult =
	| { success: true; claims: SupabaseJWTClaims }
	| { success: false; error: string };

// Cache JWKS to avoid fetching on every request
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl: string | null = null;

/**
 * Get cached JWKS key set
 */
function getJWKS(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
	const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

	// Recreate if URL changed (shouldn't happen in practice)
	if (jwks && jwksUrl === url) {
		return jwks;
	}

	jwks = createRemoteJWKSet(new URL(url));
	jwksUrl = url;
	return jwks;
}

/**
 * Verify a Supabase JWT using JWKS
 *
 * @param token - The JWT access token from Supabase
 * @param supabaseUrl - The Supabase project URL
 * @returns Verification result with claims or error
 */
export async function verifySupabaseJWT(token: string, supabaseUrl: string): Promise<VerifyResult> {
	if (!token) {
		return { success: false, error: 'No token provided' };
	}

	if (!supabaseUrl) {
		return { success: false, error: 'Supabase URL not configured' };
	}

	try {
		const { payload } = await jwtVerify(token, getJWKS(supabaseUrl), {
			issuer: `${supabaseUrl}/auth/v1`,
			audience: 'authenticated',
		});

		// Ensure we have a subject (user ID)
		if (!payload.sub) {
			return { success: false, error: 'Token missing subject claim' };
		}

		return {
			success: true,
			claims: payload as SupabaseJWTClaims,
		};
	} catch (error) {
		// Handle specific jose errors
		if (error instanceof Error) {
			if (error.message.includes('expired')) {
				return { success: false, error: 'Token expired' };
			}
			if (error.message.includes('signature')) {
				return { success: false, error: 'Invalid token signature' };
			}
			return { success: false, error: error.message };
		}
		return { success: false, error: 'Token verification failed' };
	}
}

/**
 * Clear the JWKS cache
 * Useful for testing or key rotation
 */
export function clearJWKSCache(): void {
	jwks = null;
	jwksUrl = null;
}
