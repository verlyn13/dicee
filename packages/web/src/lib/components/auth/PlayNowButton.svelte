<script lang="ts">
/**
 * PlayNowButton - Anonymous sign-in for immediate gameplay
 *
 * Mobile-first, Neo-Brutalist design with 56px touch target.
 * Creates an anonymous user session for "Play Now" flow.
 */
import { auth } from '$lib/stores/auth.svelte';

interface Props {
	onclick?: () => void;
	class?: string;
}

let { onclick, class: className = '' }: Props = $props();
let error = $state<string | null>(null);

async function handleClick() {
	error = null;
	try {
		await auth.signInAnonymously();
		onclick?.();
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to start game';
		console.error('Anonymous sign-in error:', e);
	}
}
</script>

<button
	type="button"
	class="play-now-button {className}"
	onclick={handleClick}
	disabled={auth.loading}
	aria-busy={auth.loading}
>
	{#if auth.loading}
		<span class="loading-text">Starting...</span>
	{:else}
		<span class="button-text">PLAY NOW</span>
		<span class="button-subtext">No account needed</span>
	{/if}
</button>

{#if error}
	<p class="error-message" role="alert">{error}</p>
{/if}

<style>
	.play-now-button {
		/* Neo-Brutalist: Prominent, honest button */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);

		/* Size: Full width, comfortable touch target */
		width: 100%;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2) var(--space-3);

		/* Colors: High contrast with accent */
		background: var(--color-accent);
		color: var(--color-text);
		border: var(--border-thick);

		/* Typography */
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);

		/* Interaction */
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.play-now-button:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.play-now-button:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.play-now-button:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.play-now-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.button-text {
		font-size: var(--text-h3);
		line-height: 1.2;
	}

	.button-subtext {
		font-size: var(--text-small);
		font-weight: var(--weight-normal);
		color: var(--color-text-muted);
		text-transform: none;
		letter-spacing: var(--tracking-normal);
	}

	.loading-text {
		font-size: var(--text-body);
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
		.play-now-button {
			max-width: 320px;
		}
	}
</style>
