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
import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
import MagicLinkForm from '$lib/components/auth/MagicLinkForm.svelte';
import { BottomSheet } from '$lib/components/ui';
import { auth } from '$lib/stores/auth.svelte';
import { lobby } from '$lib/stores/lobby.svelte';
import ConnectionOverlay from './ConnectionOverlay.svelte';

// Auth sheet state
let authSheetOpen = $state(false);

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
				<span class="status-dot"></span>
				{lobby.onlineDisplay}
			</span>
		</div>
		<div class="header-right">
			{#if auth.isAuthenticated}
				<a href="/profile" class="user-link">{displayName()}</a>
			{:else}
				<button class="auth-link" onclick={() => (authSheetOpen = true)}>Sign In</button>
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

	<!-- FAB for Create Room (hidden when chat is active on mobile) -->
	<button
		class="create-fab"
		class:hidden={isMobile && lobby.activeTab === 'chat'}
		onclick={handleCreateRoom}
		aria-label="Create new room"
	>
		<span class="fab-icon">+</span>
		<span class="fab-text">NEW GAME</span>
	</button>
</div>

<!-- Auth Options Bottom Sheet -->
<BottomSheet open={authSheetOpen} onClose={() => (authSheetOpen = false)} title="Sign In">
	{#snippet children()}
		<div class="auth-options">
			<p class="auth-description">
				Sign in to save your stats and appear on leaderboards.
			</p>

			<div class="auth-buttons">
				<GoogleButton />

				<div class="divider">
					<span>or</span>
				</div>

				<MagicLinkForm />
			</div>

			<p class="auth-note">
				Already playing as guest? Your progress will be saved.
			</p>
		</div>
	{/snippet}
</BottomSheet>

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
		gap: var(--space-3);
	}

	.logo {
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin: 0;
	}

	.online-indicator {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-signal-muted);
		padding: 0.25rem 0.625rem;
		border: var(--border-thin);
		border-radius: var(--radius-sm);
		background: var(--color-background);
	}

	.online-indicator.connected {
		color: var(--color-signal-live);
		border-color: var(--color-signal-live);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	.online-indicator.connected .status-dot {
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.2);
		}
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.user-link {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-text);
		text-decoration: none;
		padding: var(--space-1) var(--space-2);
		border: var(--border-thin);
		transition: background var(--transition-fast);
	}

	.user-link:hover {
		background: var(--color-accent);
	}

	.auth-link {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		color: var(--color-text);
		background: var(--color-surface);
		padding: var(--space-1) var(--space-2);
		border: var(--border-medium);
		cursor: pointer;
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
		min-width: 56px;
		height: 56px;
		border-radius: 28px;
		background: var(--color-text);
		color: var(--color-surface);
		border: none;
		font-weight: var(--weight-black);
		cursor: pointer;
		box-shadow: var(--shadow-brutal-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: 0 var(--space-3);
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
		z-index: var(--z-hud);
	}

	.create-fab:hover {
		background: var(--color-accent);
		color: var(--color-text);
		transform: scale(1.05);
	}

	.create-fab:active {
		transform: scale(0.95);
	}

	.fab-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.fab-text {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		letter-spacing: var(--tracking-wide);
	}

	/* Mobile: Icon only */
	@media (max-width: 767px) {
		.create-fab {
			width: 56px;
			padding: 0;
			border-radius: 50%;
		}

		.create-fab.hidden {
			display: none;
		}

		/* Hide FAB when keyboard is open (set by keyboard.ts) */
		:global(html.keyboard-open) .create-fab {
			display: none;
		}

		.fab-text {
			display: none;
		}

		.fab-icon {
			font-size: 2rem;
		}
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

	/* Auth Options in Bottom Sheet */
	.auth-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.auth-description {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}

	.auth-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-muted);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
		opacity: 0.3;
	}

	.divider span {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		text-transform: uppercase;
	}

	.auth-note {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}
</style>
