/**
 * Spectator Store
 *
 * Svelte 5 reactive store for spectator mode.
 * Provides reactive state for watching games without participating.
 */

import { getContext, setContext } from 'svelte';
import {
	type Prediction,
	type PredictionResult,
	type PredictionStats,
	type PredictionType,
	type SpectatorConnectionStatus,
	type SpectatorEventHandler,
	type SpectatorGameState,
	type SpectatorInfo,
	spectatorService,
} from '$lib/services/spectatorService.svelte';
import type { RoomCode, RoomPlayer } from '$lib/types/multiplayer';

// =============================================================================
// Store Types
// =============================================================================

export interface SpectatorStore {
	/** Current connection status */
	readonly status: SpectatorConnectionStatus;
	/** Whether currently connected */
	readonly isConnected: boolean;
	/** Whether currently connecting */
	readonly isConnecting: boolean;
	/** Room code being watched */
	readonly roomCode: RoomCode | null;
	/** Room status (waiting, playing, completed) */
	readonly roomStatus: string | null;
	/** Players in the game */
	readonly players: RoomPlayer[];
	/** Other spectators */
	readonly spectators: SpectatorInfo[];
	/** Spectator count */
	readonly spectatorCount: number;
	/** Last error message */
	readonly error: string | null;
	/** Display text for spectator count */
	readonly spectatorDisplay: string;
	/** Full game state (dice, scorecards, etc.) - null until game starts or sync received */
	readonly gameState: SpectatorGameState | null;

	// Prediction state (D4)
	/** Current predictions for this turn */
	readonly predictions: Prediction[];
	/** Prediction statistics */
	readonly predictionStats: PredictionStats | null;
	/** Current turn info */
	readonly currentTurn: { turnNumber: number; playerId: string } | null;
	/** Results from last turn's predictions */
	readonly lastPredictionResults: PredictionResult[];
	/** Whether predictions can be made */
	readonly canMakePrediction: boolean;

	// Actions
	watch: (roomCode: RoomCode, accessToken: string) => Promise<void>;
	stopWatching: () => void;

	// Chat actions
	sendChatMessage: (content: string) => void;
	sendTypingStart: () => void;
	sendTypingStop: () => void;

	// Prediction actions (D4)
	makePrediction: (playerId: string, type: PredictionType, exactScore?: number) => void;
	cancelPrediction: (predictionId: string) => void;
	refreshPredictions: () => void;
	refreshPredictionStats: () => void;

	// Event subscription
	subscribe: (handler: SpectatorEventHandler) => () => void;
}

// =============================================================================
// Context Key
// =============================================================================

const SPECTATOR_CONTEXT_KEY = Symbol('spectator-store');

// =============================================================================
// Store Implementation
// =============================================================================

/**
 * Create a reactive spectator store
 *
 * @param _userId - Current user's ID (from auth) - reserved for future use
 */
export function createSpectatorStore(_userId: string): SpectatorStore {
	// Reactive state using Svelte 5 runes
	let status = $state<SpectatorConnectionStatus>('disconnected');
	let roomCode = $state<RoomCode | null>(null);
	let roomStatus = $state<string | null>(null);
	let players = $state<RoomPlayer[]>([]);
	let spectators = $state<SpectatorInfo[]>([]);
	let spectatorCount = $state(0);
	let error = $state<string | null>(null);
	let gameState = $state<SpectatorGameState | null>(null);

	// Prediction state (D4)
	let predictions = $state<Prediction[]>([]);
	let predictionStats = $state<PredictionStats | null>(null);
	let currentTurn = $state<{ turnNumber: number; playerId: string } | null>(null);
	let lastPredictionResults = $state<PredictionResult[]>([]);

	// Derived state
	const isConnected = $derived(status === 'connected');
	const isConnecting = $derived(status === 'connecting');
	const spectatorDisplay = $derived(
		spectatorCount === 0
			? 'No spectators'
			: spectatorCount === 1
				? '1 spectator'
				: `${spectatorCount} spectators`,
	);
	const canMakePrediction = $derived(
		status === 'connected' && currentTurn !== null && predictions.length < 3,
	);

	// Sync with spectatorService
	function syncFromService(): void {
		const state = spectatorService.state;
		status = state.status;
		roomCode = state.roomCode;
		roomStatus = state.roomStatus;
		players = state.players;
		spectators = state.spectators;
		spectatorCount = state.spectatorCount;
		error = state.error;
		gameState = state.gameState;
		// Sync prediction state
		predictions = spectatorService.predictions;
		predictionStats = spectatorService.predictionStats;
		currentTurn = spectatorService.currentTurn;
		lastPredictionResults = spectatorService.lastPredictionResults;
	}

	// Set up status listener
	spectatorService.addStatusListener((newStatus) => {
		status = newStatus;
	});

	// Set up event handler to update local state
	spectatorService.addEventHandler(() => {
		// Sync state from service on any event
		syncFromService();
	});

	// Actions
	async function watch(code: RoomCode, accessToken: string): Promise<void> {
		error = null;
		try {
			await spectatorService.connect(code, accessToken);
			syncFromService();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to start watching';
			throw e;
		}
	}

	function stopWatching(): void {
		spectatorService.disconnect();
		syncFromService();
	}

	function sendChatMessage(content: string): void {
		spectatorService.sendChatMessage(content);
	}

	function sendTypingStart(): void {
		spectatorService.sendTypingStart();
	}

	function sendTypingStop(): void {
		spectatorService.sendTypingStop();
	}

	function subscribe(handler: SpectatorEventHandler): () => void {
		spectatorService.addEventHandler(handler);
		return () => spectatorService.removeEventHandler(handler);
	}

	// Prediction actions (D4)
	function makePrediction(playerId: string, type: PredictionType, exactScore?: number): void {
		spectatorService.makePrediction(playerId, type, exactScore);
	}

	function cancelPrediction(predictionId: string): void {
		spectatorService.cancelPrediction(predictionId);
	}

	function refreshPredictions(): void {
		spectatorService.getPredictions();
	}

	function refreshPredictionStats(): void {
		spectatorService.getPredictionStats();
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
		get roomCode() {
			return roomCode;
		},
		get roomStatus() {
			return roomStatus;
		},
		get players() {
			return players;
		},
		get spectators() {
			return spectators;
		},
		get spectatorCount() {
			return spectatorCount;
		},
		get error() {
			return error;
		},
		get spectatorDisplay() {
			return spectatorDisplay;
		},
		get gameState() {
			return gameState;
		},
		// Prediction getters (D4)
		get predictions() {
			return predictions;
		},
		get predictionStats() {
			return predictionStats;
		},
		get currentTurn() {
			return currentTurn;
		},
		get lastPredictionResults() {
			return lastPredictionResults;
		},
		get canMakePrediction() {
			return canMakePrediction;
		},
		watch,
		stopWatching,
		sendChatMessage,
		sendTypingStart,
		sendTypingStop,
		// Prediction actions (D4)
		makePrediction,
		cancelPrediction,
		refreshPredictions,
		refreshPredictionStats,
		subscribe,
	};
}

// =============================================================================
// Context Helpers
// =============================================================================

/**
 * Set spectator store in component context
 */
export function setSpectatorStore(store: SpectatorStore): void {
	setContext(SPECTATOR_CONTEXT_KEY, store);
}

/**
 * Get spectator store from component context
 */
export function getSpectatorStore(): SpectatorStore {
	const store = getContext<SpectatorStore>(SPECTATOR_CONTEXT_KEY);
	if (!store) {
		throw new Error(
			'Spectator store not found in context. Did you forget to call setSpectatorStore?',
		);
	}
	return store;
}

/**
 * Get spectator store from context if available
 */
export function getSpectatorStoreOptional(): SpectatorStore | undefined {
	return getContext<SpectatorStore>(SPECTATOR_CONTEXT_KEY);
}
