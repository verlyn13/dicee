/**
 * Multiplayer Game Store
 *
 * Svelte 5 rune-based store for multiplayer game state.
 * Manages game state sync, optimistic UI, and derived states.
 */

import { roomService } from '$lib/services/roomService.svelte';
import type {
	Category,
	DiceArray,
	GameState,
	KeptMask,
	PlayerRanking,
	Scorecard,
	ServerEvent,
} from '$lib/types/multiplayer';

// =============================================================================
// UI Phase States (for animations)
// =============================================================================

export type UIPhase = 'IDLE' | 'ROLLING' | 'RESOLVED' | 'SCORING' | 'WAITING';

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Create a multiplayer game store
 */
export function createMultiplayerGameStore(myPlayerId: string) {
	// Core state
	let gameState = $state<GameState | null>(null);
	let uiPhase = $state<UIPhase>('IDLE');
	let error = $state<string | null>(null);
	let afkWarning = $state<number | null>(null);
	let pending = $state(false);

	// ==========================================================================
	// Derived States
	// ==========================================================================

	const currentPlayerId = $derived(
		gameState ? (gameState.playerOrder[gameState.currentPlayerIndex] ?? null) : null,
	);

	const isMyTurn = $derived(currentPlayerId === myPlayerId && gameState?.phase !== 'game_over');

	const myPlayer = $derived(gameState?.players[myPlayerId] ?? null);

	const currentPlayer = $derived(
		currentPlayerId ? (gameState?.players[currentPlayerId] ?? null) : null,
	);

	const opponents = $derived(
		gameState ? Object.values(gameState.players).filter((p) => p.id !== myPlayerId) : [],
	);

	const canRoll = $derived(
		isMyTurn &&
			(gameState?.phase === 'turn_roll' || gameState?.phase === 'turn_decide') &&
			(myPlayer?.rollsRemaining ?? 0) > 0 &&
			uiPhase !== 'ROLLING' &&
			!pending,
	);

	const canKeep = $derived(
		isMyTurn &&
			gameState?.phase === 'turn_decide' &&
			myPlayer?.currentDice !== null &&
			uiPhase !== 'ROLLING' &&
			!pending,
	);

	const canScore = $derived(
		isMyTurn &&
			gameState?.phase === 'turn_decide' &&
			myPlayer?.currentDice !== null &&
			uiPhase !== 'ROLLING' &&
			uiPhase !== 'SCORING' &&
			!pending,
	);

	const currentDice = $derived(myPlayer?.currentDice ?? null);

	const keptDice = $derived(
		myPlayer?.keptDice ?? ([false, false, false, false, false] as KeptMask),
	);

	const rollsRemaining = $derived(myPlayer?.rollsRemaining ?? 3);

	const myScorecard = $derived(myPlayer?.scorecard ?? null);

	const isGameOver = $derived(gameState?.phase === 'game_over');

	const rankings = $derived(gameState?.rankings ?? null);

	const phase = $derived(gameState?.phase ?? 'waiting');

	const turnNumber = $derived(gameState?.turnNumber ?? 0);

	const roundNumber = $derived(gameState?.roundNumber ?? 0);

	// ==========================================================================
	// Event Handler
	// ==========================================================================

	function handleServerEvent(event: ServerEvent): void {
		switch (event.type) {
			case 'GAME_STARTED':
			case 'QUICK_PLAY_STARTED':
				handleGameStarted(event as unknown as Parameters<typeof handleGameStarted>[0]);
				break;

			case 'TURN_STARTED':
			case 'TURN_CHANGED':
				handleTurnStarted(event as unknown as Parameters<typeof handleTurnStarted>[0]);
				break;

			case 'DICE_ROLLED':
				handleDiceRolled(event as unknown as Parameters<typeof handleDiceRolled>[0]);
				break;

			case 'DICE_KEPT':
				handleDiceKept(event as unknown as Parameters<typeof handleDiceKept>[0]);
				break;

			case 'CATEGORY_SCORED':
				handleCategoryScored(event as unknown as Parameters<typeof handleCategoryScored>[0]);
				break;

			case 'TURN_SKIPPED':
				handleTurnSkipped(event as unknown as Parameters<typeof handleTurnSkipped>[0]);
				break;

			case 'PLAYER_AFK':
				handleAfkWarning(event as unknown as Parameters<typeof handleAfkWarning>[0]);
				break;

			case 'GAME_OVER':
				handleGameCompleted(event as unknown as Parameters<typeof handleGameCompleted>[0]);
				break;

			case 'ERROR':
				error = (event as { payload: { message: string } }).payload?.message ?? 'Unknown error';
				pending = false;
				break;
		}
	}

	function handleGameStarted(event: {
		playerOrder?: string[];
		currentPlayerId?: string;
		turnNumber?: number;
		roundNumber?: number;
		phase?: string;
		players?: Record<string, unknown>;
		roomCode?: string;
		payload?: {
			playerOrder?: string[];
			currentPlayerId?: string;
			turnNumber?: number;
			roundNumber?: number;
			phase?: string;
			players?: Record<string, unknown>;
		};
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const now = new Date().toISOString();
		const players = (data.players ?? {}) as Record<
			string,
			import('$lib/types/multiplayer').PlayerGameState
		>;
		const playerOrder = data.playerOrder ?? [];
		const currentPlayerId = data.currentPlayerId ?? '';

		// Initialize or update game state
		gameState = {
			roomCode: event.roomCode ?? gameState?.roomCode ?? '',
			phase: (data.phase as import('$lib/types/multiplayer').GamePhase) ?? 'turn_roll',
			playerOrder,
			currentPlayerIndex: playerOrder.indexOf(currentPlayerId),
			turnNumber: data.turnNumber ?? 1,
			roundNumber: data.roundNumber ?? 1,
			players,
			turnStartedAt: now,
			gameStartedAt: now,
			gameCompletedAt: null,
			rankings: null,
			config: gameState?.config ?? {
				maxPlayers: 2,
				turnTimeoutSeconds: 60,
				isPublic: false,
			},
		};

		uiPhase = currentPlayerId === myPlayerId ? 'IDLE' : 'WAITING';
		afkWarning = null;
	}

	function handleTurnStarted(event: {
		playerId?: string;
		turnNumber?: number;
		roundNumber?: number;
		currentPlayerId?: string;
		payload?: {
			playerId?: string;
			turnNumber?: number;
			roundNumber?: number;
			currentPlayerId?: string;
		};
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? data.currentPlayerId ?? '';
		const turnNumber = data.turnNumber ?? 1;
		const roundNumber = data.roundNumber ?? 1;

		if (gameState) {
			const playerIndex = gameState.playerOrder.indexOf(playerId);
			gameState = {
				...gameState,
				phase: 'turn_roll',
				currentPlayerIndex: playerIndex,
				turnNumber,
				roundNumber,
				turnStartedAt: new Date().toISOString(),
			};

			// Reset turn state for current player
			const player = gameState.players[playerId];
			if (player) {
				gameState.players = {
					...gameState.players,
					[playerId]: {
						...player,
						currentDice: null,
						keptDice: null,
						rollsRemaining: 3,
					},
				};
			}
		}
		uiPhase = playerId === myPlayerId ? 'IDLE' : 'WAITING';
		afkWarning = null;
	}

	function handleDiceRolled(event: {
		playerId?: string;
		dice?: DiceArray;
		rollNumber?: number;
		rollsRemaining?: number;
		payload?: {
			playerId?: string;
			dice?: DiceArray;
			rollNumber?: number;
			rollsRemaining?: number;
		};
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? '';
		const dice = data.dice ?? ([1, 1, 1, 1, 1] as DiceArray);
		const rollsRemaining = data.rollsRemaining ?? 0;

		if (gameState) {
			const player = gameState.players[playerId];
			if (player) {
				gameState = {
					...gameState,
					phase: 'turn_decide',
					players: {
						...gameState.players,
						[playerId]: {
							...player,
							currentDice: dice,
							keptDice: [false, false, false, false, false],
							rollsRemaining,
						},
					},
				};
			}
		}
		// Transition through ROLLING -> RESOLVED for animation
		if (playerId === myPlayerId) {
			uiPhase = 'RESOLVED';
		}
		pending = false;
		afkWarning = null;
	}

	function handleDiceKept(event: {
		playerId?: string;
		kept?: KeptMask;
		payload?: { playerId?: string; kept?: KeptMask };
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? '';
		const kept = data.kept ?? ([false, false, false, false, false] as KeptMask);

		if (gameState) {
			const player = gameState.players[playerId];
			if (player) {
				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[playerId]: {
							...player,
							keptDice: kept,
						},
					},
				};
			}
		}
		pending = false;
		afkWarning = null;
	}

	function handleCategoryScored(event: {
		playerId?: string;
		category?: string;
		score?: number;
		totalScore?: number;
		isDiceeBonus?: boolean;
		payload?: {
			playerId?: string;
			category?: string;
			score?: number;
			totalScore?: number;
			isDiceeBonus?: boolean;
		};
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? '';
		const category = (data.category ?? '') as Category;
		const score = data.score ?? 0;
		const totalScore = data.totalScore ?? 0;
		const isDiceeBonus = data.isDiceeBonus ?? false;

		if (gameState) {
			const player = gameState.players[playerId];
			if (player) {
				const newScorecard: Scorecard = {
					...player.scorecard,
					[category]: score,
				};
				if (isDiceeBonus) {
					newScorecard.diceeBonus = player.scorecard.diceeBonus + 100;
				}

				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[playerId]: {
							...player,
							scorecard: newScorecard,
							totalScore,
						},
					},
				};
			}
		}
		if (playerId === myPlayerId) {
			uiPhase = 'SCORING';
		}
		pending = false;
	}

	function handleTurnSkipped(event: {
		playerId?: string;
		reason?: 'timeout' | 'disconnect';
		categoryScored?: string;
		category?: string;
		score?: number;
		payload?: {
			playerId?: string;
			reason?: 'timeout' | 'disconnect';
			categoryScored?: string;
			category?: string;
			score?: number;
		};
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? '';
		const categoryScored = (data.categoryScored ?? data.category ?? '') as Category;
		const score = data.score ?? 0;

		if (gameState) {
			const player = gameState.players[playerId];
			if (player) {
				const newScorecard: Scorecard = {
					...player.scorecard,
					[categoryScored]: score,
				};

				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[playerId]: {
							...player,
							scorecard: newScorecard,
							currentDice: null,
							keptDice: null,
							rollsRemaining: 0,
						},
					},
				};
			}
		}
		afkWarning = null;
	}

	function handleAfkWarning(event: {
		playerId?: string;
		secondsRemaining?: number;
		payload?: { playerId?: string; secondsRemaining?: number };
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const playerId = data.playerId ?? '';
		const secondsRemaining = data.secondsRemaining ?? 0;

		if (playerId === myPlayerId) {
			afkWarning = secondsRemaining;
		}
	}

	function handleGameCompleted(event: {
		rankings?: PlayerRanking[];
		duration?: number;
		payload?: { rankings?: PlayerRanking[]; duration?: number };
	}): void {
		// Support both direct properties and nested payload (UPPERCASE format)
		const data = event.payload ?? event;
		const rankings = data.rankings ?? [];

		if (gameState) {
			gameState = {
				...gameState,
				phase: 'game_over',
				rankings,
				gameCompletedAt: new Date().toISOString(),
			};
		}
		uiPhase = 'IDLE';
		afkWarning = null;
	}

	// ==========================================================================
	// Commands
	// ==========================================================================

	function rollDice(kept: KeptMask = [false, false, false, false, false]): void {
		if (!canRoll) return;

		// Optimistic UI - immediately enter rolling state
		uiPhase = 'ROLLING';
		pending = true;
		error = null;

		// Use sendRollDice which sends DICE_ROLL (server expects uppercase)
		roomService.sendRollDice(kept);
	}

	function keepDice(indices: number[]): void {
		if (!canKeep) return;

		pending = true;
		error = null;

		// Use sendKeepDice which sends DICE_KEEP (server expects uppercase)
		roomService.sendKeepDice(indices);
	}

	function toggleKeep(index: number): void {
		if (!canKeep || !myPlayer?.keptDice) return;

		const newKept = [...myPlayer.keptDice] as KeptMask;
		newKept[index] = !newKept[index];

		const indices: number[] = [];
		for (let i = 0; i < 5; i++) {
			if (newKept[i]) indices.push(i);
		}

		keepDice(indices);
	}

	function scoreCategory(category: Category): void {
		if (!canScore) return;

		// Optimistic UI - enter scoring state
		uiPhase = 'SCORING';
		pending = true;
		error = null;

		// Use sendScoreCategory which sends CATEGORY_SCORE (server expects uppercase)
		roomService.sendScoreCategory(category);
	}

	function reset(): void {
		gameState = null;
		uiPhase = 'IDLE';
		error = null;
		afkWarning = null;
		pending = false;
	}

	// ==========================================================================
	// Subscription Management
	// ==========================================================================

	function subscribe(): () => void {
		const handler = (event: ServerEvent) => handleServerEvent(event);
		roomService.addEventHandler(handler);
		return () => {
			roomService.removeEventHandler(handler);
		};
	}

	// ==========================================================================
	// Return Store Interface
	// ==========================================================================

	return {
		// State (read-only via getters)
		get gameState() {
			return gameState;
		},
		get uiPhase() {
			return uiPhase;
		},
		get error() {
			return error;
		},
		get afkWarning() {
			return afkWarning;
		},
		get pending() {
			return pending;
		},

		// Derived states
		get isMyTurn() {
			return isMyTurn;
		},
		get myPlayer() {
			return myPlayer;
		},
		get currentPlayer() {
			return currentPlayer;
		},
		get currentPlayerId() {
			return currentPlayerId;
		},
		get opponents() {
			return opponents;
		},
		get canRoll() {
			return canRoll;
		},
		get canKeep() {
			return canKeep;
		},
		get canScore() {
			return canScore;
		},
		get currentDice() {
			return currentDice;
		},
		get keptDice() {
			return keptDice;
		},
		get rollsRemaining() {
			return rollsRemaining;
		},
		get myScorecard() {
			return myScorecard;
		},
		get isGameOver() {
			return isGameOver;
		},
		get rankings() {
			return rankings;
		},
		get phase() {
			return phase;
		},
		get turnNumber() {
			return turnNumber;
		},
		get roundNumber() {
			return roundNumber;
		},

		// Commands
		rollDice,
		keepDice,
		toggleKeep,
		scoreCategory,
		reset,

		// Subscription
		subscribe,
	};
}

// =============================================================================
// Store Type
// =============================================================================

export type MultiplayerGameStore = ReturnType<typeof createMultiplayerGameStore>;

// =============================================================================
// Context
// =============================================================================

let currentStore: MultiplayerGameStore | null = null;

export function setMultiplayerGameStore(store: MultiplayerGameStore): void {
	currentStore = store;
}

export function getMultiplayerGameStore(): MultiplayerGameStore | null {
	return currentStore;
}
