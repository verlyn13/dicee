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
			case 'game.started':
				handleGameStarted(event);
				break;

			case 'turn.started':
				handleTurnStarted(event);
				break;

			case 'dice.rolled':
				handleDiceRolled(event);
				break;

			case 'dice.kept':
				handleDiceKept(event);
				break;

			case 'category.scored':
				handleCategoryScored(event);
				break;

			case 'turn.ended':
				handleTurnEnded(event);
				break;

			case 'turn.skipped':
				handleTurnSkipped(event);
				break;

			case 'player.afk_warning':
				handleAfkWarning(event);
				break;

			case 'game.completed':
				handleGameCompleted(event);
				break;

			case 'state.sync':
				handleStateSync(event);
				break;

			case 'game.error':
				error = event.message;
				pending = false;
				break;
		}
	}

	function handleGameStarted(event: {
		playerOrder: string[];
		currentPlayerId: string;
		turnNumber: number;
	}): void {
		if (gameState) {
			gameState = {
				...gameState,
				phase: 'turn_roll',
				playerOrder: event.playerOrder,
				currentPlayerIndex: event.playerOrder.indexOf(event.currentPlayerId),
				turnNumber: event.turnNumber,
				roundNumber: 1,
				gameStartedAt: new Date().toISOString(),
				turnStartedAt: new Date().toISOString(),
			};
		}
		uiPhase = event.currentPlayerId === myPlayerId ? 'IDLE' : 'WAITING';
		afkWarning = null;
	}

	function handleTurnStarted(event: {
		playerId: string;
		turnNumber: number;
		roundNumber: number;
	}): void {
		if (gameState) {
			const playerIndex = gameState.playerOrder.indexOf(event.playerId);
			gameState = {
				...gameState,
				phase: 'turn_roll',
				currentPlayerIndex: playerIndex,
				turnNumber: event.turnNumber,
				roundNumber: event.roundNumber,
				turnStartedAt: new Date().toISOString(),
			};

			// Reset turn state for current player
			const player = gameState.players[event.playerId];
			if (player) {
				gameState.players = {
					...gameState.players,
					[event.playerId]: {
						...player,
						currentDice: null,
						keptDice: null,
						rollsRemaining: 3,
					},
				};
			}
		}
		uiPhase = event.playerId === myPlayerId ? 'IDLE' : 'WAITING';
		afkWarning = null;
	}

	function handleDiceRolled(event: {
		playerId: string;
		dice: DiceArray;
		rollNumber: number;
		rollsRemaining: number;
	}): void {
		if (gameState) {
			const player = gameState.players[event.playerId];
			if (player) {
				gameState = {
					...gameState,
					phase: 'turn_decide',
					players: {
						...gameState.players,
						[event.playerId]: {
							...player,
							currentDice: event.dice,
							keptDice: [false, false, false, false, false],
							rollsRemaining: event.rollsRemaining,
						},
					},
				};
			}
		}
		// Transition through ROLLING -> RESOLVED for animation
		if (event.playerId === myPlayerId) {
			uiPhase = 'RESOLVED';
		}
		pending = false;
		afkWarning = null;
	}

	function handleDiceKept(event: { playerId: string; kept: KeptMask }): void {
		if (gameState) {
			const player = gameState.players[event.playerId];
			if (player) {
				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[event.playerId]: {
							...player,
							keptDice: event.kept,
						},
					},
				};
			}
		}
		pending = false;
		afkWarning = null;
	}

	function handleCategoryScored(event: {
		playerId: string;
		category: string;
		score: number;
		totalScore: number;
		isDiceeBonus: boolean;
	}): void {
		if (gameState) {
			const player = gameState.players[event.playerId];
			if (player) {
				const category = event.category as Category;
				const newScorecard: Scorecard = {
					...player.scorecard,
					[category]: event.score,
				};
				if (event.isDiceeBonus) {
					newScorecard.diceeBonus = player.scorecard.diceeBonus + 100;
				}

				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[event.playerId]: {
							...player,
							scorecard: newScorecard,
							totalScore: event.totalScore,
						},
					},
				};
			}
		}
		if (event.playerId === myPlayerId) {
			uiPhase = 'SCORING';
		}
		pending = false;
	}

	function handleTurnEnded(event: { playerId: string }): void {
		if (gameState) {
			const player = gameState.players[event.playerId];
			if (player) {
				gameState = {
					...gameState,
					phase: 'turn_score',
					players: {
						...gameState.players,
						[event.playerId]: {
							...player,
							currentDice: null,
							keptDice: null,
							rollsRemaining: 0,
						},
					},
				};
			}
		}
	}

	function handleTurnSkipped(event: {
		playerId: string;
		reason: 'timeout' | 'disconnect';
		categoryScored: string;
		score: number;
	}): void {
		if (gameState) {
			const player = gameState.players[event.playerId];
			if (player) {
				const category = event.categoryScored as Category;
				const newScorecard: Scorecard = {
					...player.scorecard,
					[category]: event.score,
				};

				gameState = {
					...gameState,
					players: {
						...gameState.players,
						[event.playerId]: {
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

	function handleAfkWarning(event: { playerId: string; secondsRemaining: number }): void {
		if (event.playerId === myPlayerId) {
			afkWarning = event.secondsRemaining;
		}
	}

	function handleGameCompleted(event: { rankings: PlayerRanking[]; duration: number }): void {
		if (gameState) {
			gameState = {
				...gameState,
				phase: 'game_over',
				rankings: event.rankings,
				gameCompletedAt: new Date().toISOString(),
			};
		}
		uiPhase = 'IDLE';
		afkWarning = null;
	}

	function handleStateSync(event: { state: GameState }): void {
		gameState = event.state;
		const currentId = event.state.playerOrder[event.state.currentPlayerIndex];
		uiPhase = currentId === myPlayerId ? 'IDLE' : 'WAITING';
		pending = false;
		afkWarning = null;
		error = null;
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

		roomService.send({
			type: 'dice.roll',
			kept,
		});
	}

	function keepDice(indices: number[]): void {
		if (!canKeep) return;

		pending = true;
		error = null;

		roomService.send({
			type: 'dice.keep',
			indices,
		});
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

		roomService.send({
			type: 'category.score',
			category,
		});
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
