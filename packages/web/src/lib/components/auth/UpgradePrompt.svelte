<script lang="ts">
/**
 * UpgradePrompt - Convert anonymous user to permanent account
 *
 * Displays a prompt to link Google or email to an anonymous account.
 * Preserves user ID and all associated data.
 */
import { auth } from '$lib/stores/auth.svelte';
import GoogleButton from './GoogleButton.svelte';
import MagicLinkForm from './MagicLinkForm.svelte';

interface Props {
	title?: string;
	message?: string;
	onClose?: () => void;
	class?: string;
}

let {
	title = 'Keep Your Progress',
	message = 'Sign in to save your stats across devices and appear on leaderboards.',
	onClose,
	class: className = '',
}: Props = $props();

let showEmailForm = $state(false);
</script>

<div class="upgrade-prompt {className}" role="dialog" aria-labelledby="upgrade-title">
	<div class="prompt-header">
		<h2 id="upgrade-title" class="prompt-title">{title}</h2>
		{#if onClose}
			<button type="button" class="close-button" onclick={onClose} aria-label="Close">
				<svg viewBox="0 0 24 24" aria-hidden="true" class="close-icon">
					<path
						d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
						fill="currentColor"
					/>
				</svg>
			</button>
		{/if}
	</div>

	<p class="prompt-message">{message}</p>

	<div class="prompt-actions">
		<GoogleButton mode="link" />

		<div class="divider">
			<span class="divider-text">or</span>
		</div>

		{#if showEmailForm}
			<MagicLinkForm mode="link" />
			<button type="button" class="back-button" onclick={() => (showEmailForm = false)}>
				Back to options
			</button>
		{:else}
			<button type="button" class="email-option-button" onclick={() => (showEmailForm = true)}>
				Use Email Instead
			</button>
		{/if}
	</div>

	{#if onClose}
		<button type="button" class="dismiss-button" onclick={onClose}> Maybe Later </button>
	{/if}
</div>

<style>
	.upgrade-prompt {
		/* Layout */
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		max-width: 400px;
		padding: var(--space-3);

		/* Neo-Brutalist: White background, black border */
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.prompt-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.prompt-title {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		color: var(--color-text);
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target-min);
		height: var(--touch-target-min);
		padding: 0;
		margin: calc(-1 * var(--space-1));

		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		transition: color var(--transition-fast);
	}

	.close-button:hover {
		color: var(--color-text);
	}

	.close-button:focus-visible {
		outline: 2px solid var(--color-border);
		outline-offset: 2px;
	}

	.close-icon {
		width: 24px;
		height: 24px;
	}

	.prompt-message {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-body);
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.prompt-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.divider-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-transform: lowercase;
	}

	.email-option-button {
		width: 100%;
		min-height: var(--touch-target-min);
		padding: var(--space-1) var(--space-2);

		background: transparent;
		color: var(--color-text);
		border: var(--border-medium);

		font-family: var(--font-sans);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);

		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.email-option-button:hover {
		transform: translate(-2px, -2px);
		box-shadow: 3px 3px 0 var(--color-border);
	}

	.email-option-button:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.email-option-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.back-button {
		padding: var(--space-1);

		background: transparent;
		color: var(--color-text-muted);
		border: none;

		font-family: var(--font-sans);
		font-size: var(--text-small);

		cursor: pointer;
		text-align: center;
	}

	.back-button:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	.dismiss-button {
		margin-top: var(--space-1);
		padding: var(--space-1);

		background: transparent;
		color: var(--color-text-muted);
		border: none;

		font-family: var(--font-sans);
		font-size: var(--text-small);

		cursor: pointer;
		text-align: center;
	}

	.dismiss-button:hover {
		color: var(--color-text);
		text-decoration: underline;
	}
</style>
