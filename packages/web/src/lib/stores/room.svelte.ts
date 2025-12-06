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

	// Actions
	createRoom: (accessToken: string) => Promise<RoomCode>;
	joinRoom: (roomCode: RoomCode, accessToken: string) => Promise<void>;
	leaveRoom: () => void;
	startGame: () => void;

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

	// Derived state
	const isConnected = $derived(status === 'connected');
	const isConnecting = $derived(status === 'connecting');
	const currentPlayer = $derived(room?.players.find((p) => p.id === userId) ?? null);
	const isHost = $derived(room?.hostId === userId);
	const playerCount = $derived(room?.players.length ?? 0);
	const isFull = $derived(room ? room.players.length >= room.config.maxPlayers : false);
	const canStart = $derived(isHost && playerCount >= 2 && room?.state === 'waiting');

	// Sync with roomService
	function syncFromService(): void {
		const state = roomService.state;
		status = state.status;
		room = state.room;
		roomCode = state.roomCode;
		error = state.error;
	}

	// Set up status listener
	roomService.addStatusListener((newStatus) => {
		status = newStatus;
	});

	// Set up event handler to update local state
	roomService.addEventHandler(() => {
		// Sync room state from service on any event
		room = roomService.room;
		error = roomService.error;
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
		roomService.sendLeave();
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
		createRoom,
		joinRoom,
		leaveRoom,
		startGame,
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
