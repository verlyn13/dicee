/**
 * Room Store
 *
 * Svelte 5 reactive store for multiplayer room state.
 * Wraps the roomService to provide reactive state for components.
 */

import { getContext, setContext } from 'svelte';
import {
	type ConnectionStatus,
	roomService,
	type ServerEventHandler,
} from '$lib/services/roomService.svelte';
import type { GameRoom, RoomCode, RoomPlayer } from '$lib/types/multiplayer';

// =============================================================================
// Store Types
// =============================================================================

/**
 * Invite sent by the host, tracked locally for UI display.
 */
export interface SentInvite {
	inviteId: string;
	targetUserId: string;
	targetDisplayName: string;
	expiresAt: number;
	status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export interface RoomStore {
	/** Current connection status */
	readonly status: ConnectionStatus;
	/** Whether currently connected */
	readonly isConnected: boolean;
	/** Whether currently connecting */
	readonly isConnecting: boolean;
	/** Current room data */
	readonly room: GameRoom | null;
	/** Room code we're connected to */
	readonly roomCode: RoomCode | null;
	/** Last error message */
	readonly error: string | null;
	/** Current user's player data (if in room) */
	readonly currentPlayer: RoomPlayer | null;
	/** Whether current user is the host */
	readonly isHost: boolean;
	/** Number of players in room */
	readonly playerCount: number;
	/** Whether room is full */
	readonly isFull: boolean;
	/** Whether game can start (enough players, user is host) */
	readonly canStart: boolean;

	/** Invites sent by the host (host only) */
	readonly sentInvites: SentInvite[];
	/** Whether there are any pending invites */
	readonly hasPendingInvites: boolean;

	// Actions
	createRoom: (accessToken: string) => Promise<RoomCode>;
	joinRoom: (roomCode: RoomCode, accessToken: string) => Promise<void>;
	leaveRoom: () => void;
	startGame: () => void;
	addAIPlayer: (profileId: string) => void;
	removeAIPlayer: (playerId: string) => void;

	// Invite actions (host only)
	sendInvite: (targetUserId: string) => void;
	cancelInvite: (targetUserId: string) => void;

	// Event subscription
	subscribe: (handler: ServerEventHandler) => () => void;
}

// =============================================================================
// Context Key
// =============================================================================

const ROOM_CONTEXT_KEY = Symbol('room-store');

// =============================================================================
// Store Implementation
// =============================================================================

/**
 * Create a reactive room store
 *
 * @param userId - Current user's ID (from auth)
 */
export function createRoomStore(userId: string): RoomStore {
	// Reactive state using Svelte 5 runes
	let status = $state<ConnectionStatus>('disconnected');
	let room = $state<GameRoom | null>(null);
	let roomCode = $state<RoomCode | null>(null);
	let error = $state<string | null>(null);
	let sentInvites = $state<SentInvite[]>([]);

	// Derived state
	const isConnected = $derived(status === 'connected');
	const isConnecting = $derived(status === 'connecting');
	const currentPlayer = $derived(room?.players.find((p) => p.id === userId) ?? null);
	const isHost = $derived(room?.hostId === userId);
	const humanPlayerCount = $derived(room?.players.length ?? 0);
	const aiPlayerCount = $derived(room?.aiPlayers?.length ?? 0);
	const playerCount = $derived(humanPlayerCount + aiPlayerCount);
	const isFull = $derived(room ? playerCount >= room.config.maxPlayers : false);
	const canStart = $derived(isHost && playerCount >= 2 && room?.state === 'waiting');
	const hasPendingInvites = $derived(sentInvites.some((inv) => inv.status === 'pending'));

	// Sync with roomService
	function syncFromService(): void {
		const state = roomService.state;
		status = state.status;
		room = state.room;
		roomCode = state.roomCode;
		error = state.error;
	}

	// Initial sync in case service already has state
	syncFromService();

	// Set up status listener
	roomService.addStatusListener((newStatus) => {
		status = newStatus;
	});

	// Set up event handler to update local state
	roomService.addEventHandler(() => {
		// Sync room state from service on any event
		room = roomService.room;
		roomCode = roomService.roomCode;
		error = roomService.error;
	});

	// Set up event handler for invite events
	roomService.addEventHandler((event) => {
		switch (event.type) {
			case 'INVITE_SENT': {
				const payload = event.payload as {
					inviteId: string;
					targetUserId: string;
					targetDisplayName: string;
					expiresAt: number;
				};
				sentInvites = [
					...sentInvites,
					{
						inviteId: payload.inviteId,
						targetUserId: payload.targetUserId,
						targetDisplayName: payload.targetDisplayName,
						expiresAt: payload.expiresAt,
						status: 'pending',
					},
				];
				break;
			}
			case 'INVITE_ACCEPTED': {
				const payload = event.payload as { inviteId: string; targetUserId: string };
				sentInvites = sentInvites.map((inv) =>
					inv.inviteId === payload.inviteId ? { ...inv, status: 'accepted' as const } : inv,
				);
				break;
			}
			case 'INVITE_DECLINED': {
				const payload = event.payload as { inviteId: string; targetUserId: string };
				sentInvites = sentInvites.map((inv) =>
					inv.inviteId === payload.inviteId ? { ...inv, status: 'declined' as const } : inv,
				);
				break;
			}
			case 'INVITE_EXPIRED': {
				const payload = event.payload as { inviteId: string; targetUserId: string };
				sentInvites = sentInvites.map((inv) =>
					inv.inviteId === payload.inviteId ? { ...inv, status: 'expired' as const } : inv,
				);
				break;
			}
		}
	});

	// Actions
	async function createRoom(accessToken: string): Promise<RoomCode> {
		error = null;
		try {
			const newRoomCode = await roomService.createRoom(accessToken);
			syncFromService();
			return newRoomCode;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create room';
			throw e;
		}
	}

	async function joinRoom(code: RoomCode, accessToken: string): Promise<void> {
		error = null;
		try {
			await roomService.connect(code, accessToken);
			syncFromService();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to join room';
			throw e;
		}
	}

	function leaveRoom(): void {
		// Server handles leave on WebSocket disconnect - no explicit command needed
		roomService.disconnect();
		syncFromService();
	}

	function startGame(): void {
		if (!isHost) {
			error = 'Only the host can start the game';
			return;
		}
		roomService.sendStartGame();
	}

	function addAIPlayer(profileId: string): void {
		if (!isHost) {
			error = 'Only the host can add AI players';
			return;
		}
		if (isFull) {
			error = 'Room is full';
			return;
		}
		roomService.sendAddAIPlayer(profileId);
	}

	function removeAIPlayer(playerId: string): void {
		if (!isHost) {
			error = 'Only the host can remove AI players';
			return;
		}
		roomService.sendRemoveAIPlayer(playerId);
	}

	function sendInvite(targetUserId: string): void {
		if (!isHost) {
			error = 'Only the host can send invites';
			return;
		}
		if (isFull) {
			error = 'Room is full';
			return;
		}
		// Check if already invited
		const existingInvite = sentInvites.find(
			(inv) => inv.targetUserId === targetUserId && inv.status === 'pending',
		);
		if (existingInvite) {
			error = 'User already has a pending invite';
			return;
		}
		roomService.sendInvite(targetUserId);
	}

	function cancelInvite(targetUserId: string): void {
		if (!isHost) {
			error = 'Only the host can cancel invites';
			return;
		}
		// Remove from local state immediately (optimistic)
		sentInvites = sentInvites.filter((inv) => inv.targetUserId !== targetUserId);
		roomService.cancelInvite(targetUserId);
	}

	function subscribe(handler: ServerEventHandler): () => void {
		roomService.addEventHandler(handler);
		return () => roomService.removeEventHandler(handler);
	}

	return {
		get status() {
			return status;
		},
		get isConnected() {
			return isConnected;
		},
		get isConnecting() {
			return isConnecting;
		},
		get room() {
			return room;
		},
		get roomCode() {
			return roomCode;
		},
		get error() {
			return error;
		},
		get currentPlayer() {
			return currentPlayer;
		},
		get isHost() {
			return isHost;
		},
		get playerCount() {
			return playerCount;
		},
		get isFull() {
			return isFull;
		},
		get canStart() {
			return canStart;
		},
		get sentInvites() {
			return sentInvites;
		},
		get hasPendingInvites() {
			return hasPendingInvites;
		},
		createRoom,
		joinRoom,
		leaveRoom,
		startGame,
		addAIPlayer,
		removeAIPlayer,
		sendInvite,
		cancelInvite,
		subscribe,
	};
}

// =============================================================================
// Context Helpers
// =============================================================================

/**
 * Set room store in component context
 */
export function setRoomStore(store: RoomStore): void {
	setContext(ROOM_CONTEXT_KEY, store);
}

/**
 * Get room store from component context
 */
export function getRoomStore(): RoomStore {
	const store = getContext<RoomStore>(ROOM_CONTEXT_KEY);
	if (!store) {
		throw new Error('Room store not found in context. Did you forget to call setRoomStore?');
	}
	return store;
}

/**
 * Get room store from context if available
 */
export function getRoomStoreOptional(): RoomStore | undefined {
	return getContext<RoomStore>(ROOM_CONTEXT_KEY);
}
