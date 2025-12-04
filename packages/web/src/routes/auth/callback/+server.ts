import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * OAuth and Magic Link callback handler.
 *
 * This endpoint handles:
 * - OAuth redirects (Google sign-in)
 * - Magic link email confirmations
 * - Identity linking callbacks
 *
 * Query params:
 * - code: Authorization code from OAuth flow
 * - token_hash: Token from magic link email
 * - type: Type of callback (e.g., 'email', 'recovery')
 * - next: URL to redirect to after auth (default: '/')
 * - error: Error code from OAuth provider
 * - error_description: Human-readable error message
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const next = url.searchParams.get('next') ?? '/';
	const error = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');

	// Handle OAuth errors
	if (error) {
		console.error('Auth callback error:', error, error_description);
		const errorParam = encodeURIComponent(error_description || error);
		redirect(303, `/?auth_error=${errorParam}`);
	}

	// Handle OAuth code exchange
	if (code) {
		const { error: exchangeError } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (exchangeError) {
			console.error('Code exchange error:', exchangeError);
			redirect(303, `/?auth_error=${encodeURIComponent(exchangeError.message)}`);
		}

		// Successful OAuth - redirect to intended destination
		redirect(303, next);
	}

	// Handle magic link / email verification
	if (token_hash && type) {
		const { error: verifyError } = await locals.supabase.auth.verifyOtp({
			token_hash,
			type: type as 'email' | 'recovery' | 'invite' | 'magiclink' | 'signup' | 'email_change',
		});

		if (verifyError) {
			console.error('OTP verification error:', verifyError);
			redirect(303, `/?auth_error=${encodeURIComponent(verifyError.message)}`);
		}

		// Successful verification - redirect to intended destination
		redirect(303, next);
	}

	// No valid auth params - redirect to home
	redirect(303, '/');
};
