<script lang="ts">
/**
 * LobbyLanding - Main lobby landing page component
 *
 * Shows:
 * - Ticker bar at top
 * - Games/Chat tabs on mobile
 * - Room grid or empty state
 * - Chat panel
 * - Create room button (FAB on mobile)
 */

import { onDestroy, onMount } from 'svelte';
import { goto } from '$app/navigation';
import { auth } from '$lib/stores/auth.svelte';
import { lobby } from '$lib/stores/lobby.svelte';

import ConnectionOverlay from './ConnectionOverlay.svelte';

// Derive display name from user object
const displayName = $derived(() => {
	const user = auth.user;
	if (!user) return 'Guest';
	return (
		(user.user_metadata?.display_name as string) ||
		(user.user_metadata?.full_name as string) ||
		user.email?.split('@')[0] ||
		'Guest'
	);
});

import ChatPanel from './ChatPanel.svelte';
import EmptyRooms from './EmptyRooms.svelte';
import MobileTabToggle from './MobileTabToggle.svelte';
import RoomCard from './RoomCard.svelte';
import Ticker from './Ticker.svelte';

// Connect to lobby on mount
onMount(() => {
	lobby.connect();
});

onDestroy(() => {
	lobby.disconnect();
});

// Check if on mobile for responsive layout
let isMobile = $state(false);

onMount(() => {
	const mediaQuery = window.matchMedia('(max-width: 768px)');
	isMobile = mediaQuery.matches;

	const handler = (e: MediaQueryListEvent) => {
		isMobile = e.matches;
	};
	mediaQuery.addEventListener('change', handler);

	return () => mediaQuery.removeEventListener('change', handler);
});

// Room creation
async function handleCreateRoom() {
	// Check if user is authenticated
	if (!auth.isAuthenticated) {
		// Could show a modal, but for now navigate to auth
		// For MVP, just create with guest session
	}

	// Generate room code and navigate
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}

	// Navigate to game room
	goto(`/games/dicee/room/${code}`);
}

// Play solo (no WebSocket needed)
function handlePlaySolo() {
	goto('/games/dicee');
}
</script>

<ConnectionOverlay />

<div class="lobby-landing">
	<!-- Header -->
	<header class="lobby-header">
		<div class="header-left">
			<h1 class="logo">DICEE</h1>
			<span class="online-indicator" class:connected={lobby.connectionState === 'connected'}>
				{lobby.onlineDisplay}
			</span>
		</div>
		<div class="header-right">
			{#if auth.isAuthenticated}
				<span class="user-name">{displayName()}</span>
			{:else}
				<a href="/auth/login" class="auth-link">Sign In</a>
			{/if}
		</div>
	</header>

	<!-- Ticker -->
	<Ticker />

	<!-- Main Content -->
	<main class="lobby-main">
		<!-- Mobile Tab Toggle -->
		{#if isMobile}
			<div class="mobile-tabs">
				<MobileTabToggle gamesCount={lobby.rooms.length} />
			</div>
		{/if}

		<div class="lobby-content" class:mobile={isMobile}>
			<!-- Games Panel -->
			<section
				class="games-panel"
				class:hidden={isMobile && lobby.activeTab !== 'games'}
				aria-label="Game Rooms"
			>
				<div class="panel-header">
					<h2>Open Games</h2>
					<button class="solo-btn" onclick={handlePlaySolo}>
						SOLO
					</button>
				</div>

				{#if lobby.rooms.length === 0}
					<EmptyRooms />
				{:else}
					<div class="room-grid">
						{#each lobby.rooms as room (room.code)}
							<RoomCard {room} />
						{/each}
					</div>
				{/if}
			</section>

			<!-- Chat Panel -->
			<section
				class="chat-section"
				class:hidden={isMobile && lobby.activeTab !== 'chat'}
				aria-label="Lobby Chat"
			>
				<ChatPanel />
			</section>
		</div>
	</main>

	<!-- FAB for Create Room -->
	<button class="create-fab" onclick={handleCreateRoom} aria-label="Create new room">
		<span class="fab-plus">+</span>
	</button>
</div>

<style>
	.lobby-landing {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		background: var(--color-background);
	}

	/* Header */
	.lobby-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thick);
		background: var(--color-surface);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.logo {
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin: 0;
	}

	.online-indicator {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-signal-muted);
		padding: 0.25rem 0.5rem;
		border: var(--border-thin);
	}

	.online-indicator.connected {
		color: var(--color-signal-live);
		border-color: var(--color-signal-live);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.user-name {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
	}

	.auth-link {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		color: var(--color-text);
		text-decoration: none;
		padding: var(--space-1) var(--space-2);
		border: var(--border-medium);
		transition: background var(--transition-fast);
	}

	.auth-link:hover {
		background: var(--color-accent);
	}

	/* Main Content */
	.lobby-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.mobile-tabs {
		padding: var(--space-2);
	}

	.lobby-content {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
		padding: var(--space-2);
		overflow: hidden;
	}

	.lobby-content:not(.mobile) {
		grid-template-columns: 2fr 1fr;
	}

	/* Games Panel */
	.games-panel {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.games-panel.hidden {
		display: none;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.panel-header h2 {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	.solo-btn {
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.solo-btn:hover {
		background: var(--color-accent);
		transform: translateY(-2px);
	}

	.room-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-2);
		overflow-y: auto;
		padding-bottom: var(--space-4);
	}

	/* Chat Section */
	.chat-section {
		display: flex;
		flex-direction: column;
		min-height: 300px;
		max-height: 100%;
		overflow: hidden;
	}

	.chat-section.hidden {
		display: none;
	}

	/* FAB */
	.create-fab {
		position: fixed;
		bottom: var(--space-3);
		right: var(--space-3);
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-text);
		color: var(--color-surface);
		border: none;
		font-size: 2rem;
		font-weight: var(--weight-black);
		cursor: pointer;
		box-shadow: var(--shadow-brutal-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
		z-index: var(--z-hud);
	}

	.create-fab:hover {
		background: var(--color-accent);
		color: var(--color-text);
		transform: scale(1.1);
	}

	.create-fab:active {
		transform: scale(0.95);
	}

	.fab-plus {
		line-height: 1;
		margin-top: -2px;
	}

	/* Desktop adjustments */
	@media (min-width: 768px) {
		.lobby-content {
			padding: var(--space-3);
			max-width: 1200px;
			margin: 0 auto;
			width: 100%;
		}

		.chat-section {
			min-height: 400px;
		}

		.create-fab {
			bottom: var(--space-4);
			right: var(--space-4);
			width: 64px;
			height: 64px;
		}
	}

	/* Large desktop */
	@media (min-width: 1024px) {
		.lobby-content {
			grid-template-columns: 2fr 1fr;
		}
	}
</style>
