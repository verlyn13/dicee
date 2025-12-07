<script lang="ts">
/**
 * LobbyGate - Inline lobby code entry
 *
 * Allows quick entry of 6-char room codes to join lobbies.
 * Auto-navigates on valid code entry.
 * Also provides button to create new lobby.
 */
import { goto } from '$app/navigation';

let code = $state('');
let isNavigating = $state(false);

// TODO: Connect to Durable Objects presence room for real-time count
// For now, show "LIVE" indicator when game lobby is configured
import { env } from '$env/dynamic/public';

const isLive = $derived(!!env.PUBLIC_WORKER_HOST);

function handleCodeChange(event: Event) {
	const target = event.target as HTMLInputElement;
	// Only allow alphanumeric characters
	const value = target.value
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 6);
	code = value;

	// Auto-navigate on complete code
	if (value.length === 6 && !isNavigating) {
		isNavigating = true;
		setTimeout(() => {
			goto(`/lobby/${value.toLowerCase()}`);
		}, 200);
	}
}

function handleCreateNew() {
	if (isNavigating) return;
	isNavigating = true;
	// Generate a 6-character room code
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
	let roomCode = '';
	for (let i = 0; i < 6; i++) {
		roomCode += chars[Math.floor(Math.random() * chars.length)];
	}
	goto(`/lobby/${roomCode.toLowerCase()}`);
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter' && code.length === 6) {
		event.preventDefault();
		if (!isNavigating) {
			isNavigating = true;
			goto(`/lobby/${code.toLowerCase()}`);
		}
	}
}
</script>

<div class="lobby-card">
	<div class="lobby-header">
		<div class="online-indicator">
			<div class="pulse-dot"></div>
			<span class="online-count">{isLive ? 'LIVE' : 'OFFLINE'}</span>
		</div>
		<button class="create-button" onclick={handleCreateNew} aria-label="Create new lobby">
			<svg
				class="plus-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
	</div>

	<div class="code-input-container">
		<input
			type="text"
			value={code}
			oninput={handleCodeChange}
			onkeydown={handleKeydown}
			placeholder="CODE"
			maxlength="6"
			class="code-input"
			class:navigating={isNavigating}
			autocomplete="off"
			autocapitalize="characters"
			disabled={isNavigating}
		/>
	</div>

	<div class="lobby-footer">
		<span class="hint">Enter 6-char code</span>
	</div>
</div>

<style>
	.lobby-card {
		width: 100%;
		height: 100%;
		border: var(--border-thick);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-brutal);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
	}

	.lobby-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-2);
	}

	.online-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.pulse-dot {
		width: 0.5rem;
		height: 0.5rem;
		background: var(--color-accent);
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.online-count {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.create-button {
		width: 2rem;
		height: 2rem;
		border: var(--border-thick);
		border-radius: var(--radius-sm);
		background: var(--color-text);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 2px 2px 0 0 rgba(24, 24, 27, 0.3);
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.create-button:hover {
		background: var(--color-accent);
	}

	.create-button:active {
		transform: translate(1px, 1px);
		box-shadow: 1px 1px 0 0 rgba(24, 24, 27, 0.3);
	}

	.plus-icon {
		width: 1rem;
		height: 1rem;
		color: var(--color-surface);
	}

	.create-button:hover .plus-icon {
		color: var(--color-text);
	}

	.code-input-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.code-input {
		width: 100%;
		text-align: center;
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		letter-spacing: var(--tracking-widest);
		border: var(--border-thick);
		border-radius: var(--radius-sm);
		padding: var(--space-1);
		background: var(--color-background);
		text-transform: uppercase;
		transition:
			box-shadow var(--transition-fast),
			border-color var(--transition-fast);
	}

	.code-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.3;
	}

	.code-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-accent);
	}

	.code-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.code-input.navigating {
		background: var(--color-accent-light);
		border-color: var(--color-accent-dark);
	}

	@media (min-width: 768px) {
		.code-input {
			font-size: var(--text-h2);
		}
	}

	.lobby-footer {
		text-align: center;
		margin-top: var(--space-1);
	}

	.hint {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}
</style>
