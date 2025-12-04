<script lang="ts">
/**
 * GoogleButton - OAuth sign-in with Google
 *
 * Neo-Brutalist design. Can be used for both sign-in and linking.
 */
import { auth } from '$lib/stores/auth.svelte';

interface Props {
	mode?: 'signin' | 'link';
	redirectTo?: string;
	class?: string;
}

let { mode = 'signin', redirectTo, class: className = '' }: Props = $props();
let error = $state<string | null>(null);
let loading = $state(false);

const buttonText = $derived(mode === 'link' ? 'Link Google Account' : 'Continue with Google');

async function handleClick() {
	error = null;
	loading = true;
	try {
		if (mode === 'link') {
			await auth.linkGoogle(redirectTo);
		} else {
			await auth.signInWithGoogle(redirectTo);
		}
		// User will be redirected, no need to reset loading
	} catch (e) {
		loading = false;
		error = e instanceof Error ? e.message : 'Google sign-in failed';
		console.error('Google auth error:', e);
	}
}
</script>

<button
	type="button"
	class="google-button {className}"
	onclick={handleClick}
	disabled={loading}
	aria-busy={loading}
>
	{#if loading}
		<span class="loading-indicator">Redirecting...</span>
	{:else}
		<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
		<span class="button-text">{buttonText}</span>
	{/if}
</button>

{#if error}
	<p class="error-message" role="alert">{error}</p>
{/if}

<style>
	.google-button {
		/* Layout */
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);

		/* Size: Full width, comfortable touch target */
		width: 100%;
		min-height: var(--touch-target-min);
		padding: var(--space-1) var(--space-2);

		/* Neo-Brutalist: White background, black border */
		background: var(--color-surface);
		color: var(--color-text);
		border: var(--border-medium);

		/* Typography */
		font-family: var(--font-sans);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);

		/* Interaction */
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.google-button:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 3px 3px 0 var(--color-border);
	}

	.google-button:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.google-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.google-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.google-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.button-text {
		line-height: 1.2;
	}

	.loading-indicator {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.error-message {
		margin-top: var(--space-1);
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}

	/* Desktop: Constrain width */
	@media (min-width: 768px) {
		.google-button {
			max-width: 320px;
		}
	}
</style>
