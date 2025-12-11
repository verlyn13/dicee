<script lang="ts">
/**
 * RoomLobby - Main lobby view when connected to a room
 *
 * Shows room code, player list, and game controls.
 * Host can start the game when 2+ players are present.
 * Supports adding AI opponents for practice games.
 */
import { onMount } from 'svelte';
import { ChatPanel } from '$lib/components/chat';
import { Avatar } from '$lib/components/ui';
import { auth } from '$lib/stores/auth.svelte';
import type { ChatStore } from '$lib/stores/chat.svelte';
import { lobby } from '$lib/stores/lobby.svelte';
import { getRoomStore } from '$lib/stores/room.svelte';
import AIOpponentSelector from './AIOpponentSelector.svelte';
import InvitePlayerModal from './InvitePlayerModal.svelte';
import PlayerListItem from './PlayerListItem.svelte';

interface Props {
	/** Optional chat store for chat functionality */
	chatStore?: ChatStore;
	/** Callback when leaving the room */
	onleave?: () => void;
	/** Callback when game starts */
	ongamestart?: () => void;
	/** Additional CSS classes */
	class?: string;
}

let { chatStore, onleave, ongamestart, class: className = '' }: Props = $props();

const room = getRoomStore();

let countdown = $state<number | null>(null);
let chatCollapsed = $state(false); // Chat visible by default in waiting room
let showAISelector = $state(false);
let showInviteModal = $state(false);
let showExternalShare = $state(false);
let selectedAIProfiles = $state<string[]>([]);
let copiedCode = $state(false);

function handleChatToggle(): void {
	chatCollapsed = !chatCollapsed;
}

// Keyboard shortcuts: 'C' to toggle chat, 'Escape' to close chat
onMount(() => {
	function handleKeydown(e: KeyboardEvent): void {
		// Skip if typing in input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}

		// 'C' toggles chat panel
		if (e.key.toLowerCase() === 'c' && chatStore) {
			e.preventDefault();
			handleChatToggle();
		}

		// 'Escape' closes chat if open
		if (e.key === 'Escape' && !chatCollapsed) {
			e.preventDefault();
			handleChatToggle();
		}
	}

	document.addEventListener('keydown', handleKeydown);
	return () => document.removeEventListener('keydown', handleKeydown);
});

// Subscribe to game starting events
$effect(() => {
	const unsubscribe = room.subscribe((event) => {
		if (event.type === 'GAME_STARTING') {
			// Start countdown timer (server sends playerCount, client counts down)
			countdown = 3;
		} else if (event.type === 'GAME_STARTED' || event.type === 'QUICK_PLAY_STARTED') {
			countdown = null;
			ongamestart?.();
		}
	});

	return unsubscribe;
});

function handleLeave() {
	room.leaveRoom();
	onleave?.();
}

function handleStart() {
	room.startGame();
}

/** Copy room code to clipboard */
async function copyCode() {
	if (!room.roomCode) return;
	try {
		await navigator.clipboard.writeText(room.roomCode);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 2000);
	} catch {
		console.warn('Clipboard API not available');
	}
}

/** Copy invite link to clipboard */
async function copyInviteLink() {
	if (!room.roomCode) return;
	try {
		const url = `${window.location.origin}/games/dicee/room/${room.roomCode}`;
		await navigator.clipboard.writeText(url);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 2000);
	} catch {
		console.warn('Clipboard API not available');
	}
}

/** Toggle AI selector modal */
function toggleAISelector() {
	showAISelector = !showAISelector;
}

/** Handle AI profile selection */
function handleAISelect(profileIds: string[]) {
	selectedAIProfiles = profileIds;
}

/** Add selected AI to the game */
function addAIOpponent() {
	if (selectedAIProfiles.length === 0) return;
	room.addAIPlayer(selectedAIProfiles[0]);
	showAISelector = false;
	selectedAIProfiles = [];
}

const waitingMessage = $derived.by(() => {
	if (room.playerCount < 2) {
		return 'Waiting for more players...';
	}
	if (!room.isHost) {
		return 'Waiting for host to start...';
	}
	return null;
});

// Toggle invite modal
function toggleInviteModal() {
	showInviteModal = !showInviteModal;
}

// Toggle external share section
function toggleExternalShare() {
	showExternalShare = !showExternalShare;
}

// Send invite to a user (called from modal)
function handleInviteUser(userId: string) {
	room.sendInvite(userId);
}

// Get player IDs for the invite modal filter
const playerIds = $derived(room.room?.players.map((p) => p.id) ?? []);
</script>

<div class="room-lobby {className}">
	<!-- Room Header -->
	<header class="lobby-header">
		<button type="button" class="leave-button" onclick={handleLeave}>
			← LEAVE
		</button>
		<h1 class="lobby-title">WAITING ROOM</h1>
		{#if chatStore}
			<button
				type="button"
				class="chat-toggle"
				onclick={handleChatToggle}
				aria-label="Toggle chat"
			>
				💬
				{#if chatStore.hasUnread}
					<span class="unread-dot"></span>
				{/if}
			</button>
		{/if}
	</header>

	<!-- Primary Actions (Host only, when room not full) -->
	{#if room.isHost && !room.isFull}
		<section class="action-buttons">
			<button type="button" class="action-btn invite-btn" onclick={toggleInviteModal}>
				<span class="action-icon">👥</span>
				<span class="action-label">Invite Player</span>
			</button>
			<button type="button" class="action-btn ai-btn" onclick={toggleAISelector}>
				<span class="action-icon">🤖</span>
				<span class="action-label">Add AI</span>
			</button>
		</section>
	{/if}

	<!-- Player List -->
	<section class="player-section">
		<h2 class="section-title">
			Players ({room.playerCount}/{room.room?.config.maxPlayers ?? 4})
		</h2>

		<div class="player-list">
			<!-- Human players -->
			{#each room.room?.players ?? [] as player (player.id)}
				<PlayerListItem {player} isCurrentUser={player.id === auth.userId} />
			{/each}
			
			<!-- AI players -->
			{#each room.room?.aiPlayers ?? [] as aiPlayer (aiPlayer.id)}
				<div class="player-item ai-player">
					<span class="player-avatar">🤖</span>
					<span class="player-name">{aiPlayer.displayName}</span>
					<span class="player-badge ai-badge">AI</span>
				</div>
			{/each}
			
			<!-- Empty slots -->
			{#each Array((room.room?.config.maxPlayers ?? 4) - room.playerCount) as _, i}
				<div class="empty-slot">
					<span class="empty-slot-icon">👤</span>
					<span class="empty-slot-text">Waiting for player...</span>
				</div>
			{/each}
		</div>

	</section>

	<!-- External Sharing (Collapsed by default) -->
	{#if room.isHost}
		<section class="external-share-section">
			<button
				type="button"
				class="external-toggle"
				onclick={toggleExternalShare}
				aria-expanded={showExternalShare}
			>
				<span class="toggle-icon">{showExternalShare ? '▼' : '▶'}</span>
				<span class="toggle-label">Share externally</span>
			</button>
			{#if showExternalShare}
				<div class="external-content">
					<div class="share-row">
						<span class="code-label">Room:</span>
						<span class="code-value">{room.roomCode}</span>
						<button type="button" class="share-btn" onclick={copyCode} title="Copy room code">
							{copiedCode ? '✓' : '📋'}
						</button>
						<button type="button" class="share-btn" onclick={copyInviteLink} title="Copy invite link">
							🔗
						</button>
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Game Controls -->
	<footer class="lobby-footer">
		{#if countdown !== null}
			<!-- Countdown state -->
			<div class="countdown">
				<span class="countdown-label">Game starting in</span>
				<span class="countdown-number">{countdown}</span>
			</div>
		{:else if room.canStart}
			<!-- Host can start -->
			<button type="button" class="start-button" onclick={handleStart}>
				START GAME
			</button>
		{:else if waitingMessage}
			<!-- Waiting state -->
			<p class="waiting-message">{waitingMessage}</p>
		{/if}

		{#if room.error}
			<p class="error-message" role="alert">{room.error}</p>
		{/if}

		<!-- Keyboard Shortcuts Hint (desktop only) -->
		{#if chatStore}
			<div class="keyboard-hints">
				<span class="hint-label">Keys:</span>
				<span class="hint-key">C</span> chat
				<span class="hint-key">ESC</span> close
			</div>
		{/if}
	</footer>

	<!-- Chat Panel -->
	{#if chatStore}
		<ChatPanel collapsed={chatCollapsed} onToggle={handleChatToggle} />
	{/if}

	<!-- AI Selector Modal -->
	{#if showAISelector}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal-backdrop" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.target === e.currentTarget && toggleAISelector()}>
			<div class="modal-content">
				<header class="modal-header">
					<h2 class="modal-title">Add AI Opponent</h2>
					<button type="button" class="modal-close" onclick={toggleAISelector}>✕</button>
				</header>
				<div class="modal-body">
					<AIOpponentSelector
						selected={selectedAIProfiles}
						onSelect={handleAISelect}
						maxSelection={1}
					/>
				</div>
				<footer class="modal-footer">
					<button type="button" class="cancel-btn" onclick={toggleAISelector}>Cancel</button>
					<button type="button" class="add-btn" onclick={addAIOpponent} disabled={selectedAIProfiles.length === 0}>
						Add to Game
					</button>
				</footer>
			</div>
		</div>
	{/if}

	<!-- Invite Player Modal -->
	<InvitePlayerModal
		open={showInviteModal}
		roomCode={room.roomCode ?? ''}
		{playerIds}
		sentInvites={room.sentInvites}
		onClose={toggleInviteModal}
		onInvite={handleInviteUser}
	/>
</div>

<style>
	.room-lobby {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
		max-width: 480px;
		margin: 0 auto; /* Horizontal center only */
	}

	/* Header */
	.lobby-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.room-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.room-label {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-text-muted);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-bold);
		letter-spacing: 0.15em;
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.room-code:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.leave-button {
		padding: var(--space-1) var(--space-2);
		min-height: var(--touch-target-minimum);
		background: var(--color-surface);
		border: var(--border-medium);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-danger);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.leave-button:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.chat-toggle {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.chat-toggle:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.unread-dot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 10px;
		height: 10px;
		background: var(--color-accent);
		border-radius: 50%;
		border: 2px solid var(--color-surface);
	}

	/* Player Section */
	.player-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.section-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	/* Footer */
	.lobby-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.start-button {
		width: 100%;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2) var(--space-3);
		background: var(--color-success);
		border: var(--border-thick);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.start-button:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.start-button:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.waiting-message {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-align: center;
		padding: var(--space-2);
	}

	.countdown {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3);
		background: var(--color-accent);
		border: var(--border-thick);
		width: 100%;
	}

	.countdown-label {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.countdown-number {
		font-family: var(--font-mono);
		font-size: var(--text-h1);
		font-weight: var(--weight-bold);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	.error-message {
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}

	/* New styles for enhanced lobby */
	.lobby-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	/* Primary Action Buttons */
	.action-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-thick);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.action-btn:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.action-btn:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.action-btn.invite-btn {
		background: var(--color-primary);
	}

	.action-btn.ai-btn {
		background: var(--color-success);
	}

	.action-icon {
		font-size: var(--text-h2);
	}

	.action-label {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	/* External Sharing Section (Collapsed by default) */
	.external-share-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.external-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
		font-size: var(--text-small);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.external-toggle:hover {
		background: var(--color-surface);
	}

	.toggle-icon {
		font-size: var(--text-tiny);
	}

	.toggle-label {
		font-weight: var(--weight-medium);
	}

	.external-content {
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.share-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.code-label {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.code-value {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		letter-spacing: 0.1em;
		flex: 1;
	}

	.share-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-background);
		border: var(--border-medium);
		font-size: var(--text-body);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.share-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.empty-slot {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
		border-style: dashed;
		opacity: 0.6;
	}

	.empty-slot-icon {
		font-size: var(--text-h3);
		opacity: 0.5;
	}

	.empty-slot-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* AI player item */
	.player-item.ai-player {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.player-avatar {
		font-size: var(--text-h3);
	}

	.player-name {
		flex: 1;
		font-weight: var(--weight-semibold);
	}

	.player-badge.ai-badge {
		padding: var(--space-0) var(--space-1);
		background: var(--color-primary);
		border: var(--border-thin);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-3);
		background: rgba(0, 0, 0, 0.7);
	}

	.modal-content {
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--color-background);
		border: var(--border-thick);
		box-shadow: 8px 8px 0 var(--color-border);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-medium);
		background: var(--color-surface);
	}

	.modal-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	.modal-close {
		appearance: none;
		background: none;
		border: var(--border-thin);
		padding: var(--space-1);
		font-size: var(--text-body);
		cursor: pointer;
		line-height: 1;
	}

	.modal-close:hover {
		background: var(--color-surface-alt);
	}

	.modal-body {
		padding: var(--space-3);
	}

	.modal-footer {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
		padding: var(--space-2) var(--space-3);
		border-top: var(--border-medium);
		background: var(--color-surface);
	}

	.cancel-btn,
	.add-btn {
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.cancel-btn {
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.add-btn {
		background: var(--color-primary);
		color: var(--color-text-on-primary, var(--color-text));
		border: var(--border-medium);
	}

	.cancel-btn:hover,
	.add-btn:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Keyboard Hints */
	.keyboard-hints {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.hint-label {
		font-weight: var(--weight-semibold);
	}

	.hint-key {
		display: inline-block;
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		background: var(--color-surface);
		border: var(--border-thin);
	}

	/* Hide keyboard hints on mobile (no physical keyboard) */
	@media (max-width: 768px) {
		.keyboard-hints {
			display: none;
		}
	}
</style>
