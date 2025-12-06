<script lang="ts">
/**
 * Lobby Page - Create or join multiplayer rooms
 *
 * Shows create/join options when not in a room,
 * shows the room lobby when connected.
 */
import { goto } from '$app/navigation';
import CreateRoomButton from '$lib/components/lobby/CreateRoomButton.svelte';
import JoinRoomForm from '$lib/components/lobby/JoinRoomForm.svelte';
import RoomLobby from '$lib/components/lobby/RoomLobby.svelte';
import { auth } from '$lib/stores/auth.svelte';
import { createRoomStore, setRoomStore } from '$lib/stores/room.svelte';

// Create and provide room store for this page
const roomStore = auth.userId ? createRoomStore(auth.userId) : null;
if (roomStore) {
	setRoomStore(roomStore);
}

// Redirect to home if not authenticated
$effect(() => {
	if (auth.initialized && !auth.isAuthenticated) {
		goto('/');
	}
});

function handleGameStart() {
	// TODO: Phase 5 - Navigate to game page
	// For now, just log
	console.log('Game started! Navigate to /game when implemented');
}

function handleLeave() {
	// Room store handles cleanup, just stay on lobby page
}

const isInRoom = $derived(roomStore?.isConnected ?? false);
</script>

<svelte:head>
	<title>Lobby | Dicee</title>
</svelte:head>

<main class="lobby-page">
	{#if !auth.initialized}
		<!-- Loading state -->
		<div class="loading">
			<p>Loading...</p>
		</div>
	{:else if !roomStore}
		<!-- No user ID available -->
		<div class="error-state">
			<p>Unable to initialize lobby. Please sign in.</p>
			<a href="/" class="back-link">Back to Home</a>
		</div>
	{:else if isInRoom}
		<!-- Connected to a room -->
		<RoomLobby onleave={handleLeave} ongamestart={handleGameStart} />
	{:else}
		<!-- Not in a room - show create/join options -->
		<div class="lobby-options">
			<header class="lobby-header">
				<h1 class="page-title">MULTIPLAYER</h1>
				<p class="page-subtitle">Create a room or join with a code</p>
			</header>

			<div class="options-container">
				<section class="option-section">
					<CreateRoomButton />
				</section>

				<div class="divider">
					<span class="divider-text">OR</span>
				</div>

				<section class="option-section">
					<JoinRoomForm />
				</section>
			</div>

			<footer class="lobby-footer">
				<a href="/" class="back-link">← Back to Home</a>
			</footer>
		</div>
	{/if}
</main>

<style>
	.lobby-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-3);
	}

	.loading,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		text-align: center;
	}

	.lobby-options {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		width: 100%;
		max-width: 400px;
	}

	.lobby-header {
		text-align: center;
	}

	.page-title {
		font-size: var(--text-h1);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin-bottom: var(--space-1);
	}

	.page-subtitle {
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	.options-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
	}

	.option-section {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 2px;
		background: var(--color-border);
	}

	.divider-text {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.lobby-footer {
		margin-top: var(--space-2);
	}

	.back-link {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.back-link:hover {
		color: var(--color-text);
	}
</style>
