/**
 * AI Controller
 *
 * Manages AI player turns in a game room.
 * Coordinates between brain decisions and game state.
 *
 * Key responsibilities:
 * - Execute AI turn steps with natural timing
 * - Translate brain decisions to game commands
 * - Handle turn timeouts and errors
 * - Emit events for UI updates
 */

import type { Category, KeptMask, Scorecard, MultiplayerGameState } from '../game';
import type {
	AIProfile,
	AIPlayerState,
	AIEvent,
	GameContext,
	TurnDecision,
} from './types';
import type { AIBrain } from './brain';
import { createBrain, initializeBrainFactory } from './brain';
import { getProfile } from './profiles';

// ============================================================================
// Types
// ============================================================================

/**
 * Commands that the controller can issue to the game room.
 */
export type AICommand =
	| { type: 'roll' }
	| { type: 'keep'; keepMask: KeptMask }
	| { type: 'score'; category: Category };

/**
 * Callback for executing AI commands on game state.
 */
export type CommandExecutor = (command: AICommand) => Promise<void>;

/**
 * Callback for emitting AI events.
 */
export type EventEmitter = (event: AIEvent) => void;

/**
 * Controller configuration.
 */
export interface AIControllerConfig {
	/** Minimum delay between actions (ms) */
	minDelayMs: number;

	/** Maximum delay for any single action (ms) */
	maxDelayMs: number;

	/** Whether to emit chat messages */
	enableChat: boolean;

	/** Whether to emit thinking events */
	emitThinkingEvents: boolean;
}

const DEFAULT_CONFIG: AIControllerConfig = {
	minDelayMs: 500,
	maxDelayMs: 10000,
	enableChat: true,
	emitThinkingEvents: true,
};

// ============================================================================
// AI Controller
// ============================================================================

/**
 * AI Controller - manages AI player turns.
 *
 * Usage:
 * ```typescript
 * const controller = new AIController();
 * await controller.initialize();
 *
 * // Add AI player to a game
 * controller.addPlayer('ai-1', 'carmen');
 *
 * // Execute their turn
 * await controller.executeTurn('ai-1', gameState, executeCommand, emitEvent);
 * ```
 */
export class AIController {
	private config: AIControllerConfig;
	private players: Map<string, AIPlayerState> = new Map();
	private brains: Map<string, AIBrain> = new Map();
	private initialized = false;

	constructor(config: Partial<AIControllerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Initialize the controller.
	 * Must be called before adding players or executing turns.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		await initializeBrainFactory(true); // Use TypeScript fallback for now
		this.initialized = true;
	}

	/**
	 * Add an AI player to the controller.
	 *
	 * @param playerId - Unique player ID
	 * @param profileId - Profile ID or AIProfile object
	 */
	async addPlayer(playerId: string, profileId: string | AIProfile): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		const profile =
			typeof profileId === 'string' ? getProfile(profileId) : profileId;

		if (!profile) {
			throw new Error(`Unknown AI profile: ${profileId}`);
		}

		// Create brain for this player
		const brain = await createBrain(profile);

		this.players.set(playerId, {
			playerId,
			profile,
			turnStep: 0,
			isThinking: false,
			lastActionAt: 0,
			accumulatedThinkTime: 0,
		});

		this.brains.set(playerId, brain);
	}

	/**
	 * Remove an AI player.
	 */
	removePlayer(playerId: string): void {
		const brain = this.brains.get(playerId);
		if (brain) {
			brain.dispose();
		}

		this.players.delete(playerId);
		this.brains.delete(playerId);
	}

	/**
	 * Check if a player is managed by this controller.
	 */
	hasPlayer(playerId: string): boolean {
		return this.players.has(playerId);
	}

	/**
	 * Get player state.
	 */
	getPlayerState(playerId: string): AIPlayerState | undefined {
		return this.players.get(playerId);
	}

	/**
	 * Execute a complete AI turn.
	 *
	 * This method handles the entire turn from first roll to scoring,
	 * with appropriate delays between actions.
	 *
	 * @param playerId - AI player ID
	 * @param getGameState - Function to get current game state (called each step for fresh state)
	 * @param execute - Callback to execute commands
	 * @param emit - Callback to emit events
	 */
	async executeTurn(
		playerId: string,
		getGameState: () => Promise<MultiplayerGameState | null>,
		execute: CommandExecutor,
		emit: EventEmitter,
	): Promise<void> {
		const playerState = this.players.get(playerId);
		const brain = this.brains.get(playerId);

		if (!playerState || !brain) {
			throw new Error(`AI player not found: ${playerId}`);
		}

		// Reset turn state
		playerState.turnStep = 0;
		playerState.accumulatedThinkTime = 0;

		// Execute turn steps until we score
		let turnComplete = false;
		let maxSteps = 10; // Safety limit

		while (!turnComplete && maxSteps > 0) {
			// Get fresh game state for each step
			const gameState = await getGameState();
			if (!gameState) {
				console.error('[AIController] No game state available');
				return;
			}

			const decision = await this.executeTurnStep(
				playerId,
				gameState,
				execute,
				emit,
			);

			if (decision.action === 'score') {
				turnComplete = true;
			}

			maxSteps--;
		}
	}

	/**
	 * Execute a single step of an AI turn.
	 *
	 * Returns the decision made. Call repeatedly until action is 'score'.
	 */
	async executeTurnStep(
		playerId: string,
		gameState: MultiplayerGameState,
		execute: CommandExecutor,
		emit: EventEmitter,
	): Promise<TurnDecision> {
		const playerState = this.players.get(playerId);
		const brain = this.brains.get(playerId);

		if (!playerState || !brain) {
			throw new Error(`AI player not found: ${playerId}`);
		}

		// Mark as thinking
		playerState.isThinking = true;

		// Build game context
		const context = this.buildGameContext(playerId, gameState);

		// Get thinking time estimate
		const thinkTime = brain.estimateThinkingTime(context, playerState.profile);
		const clampedThinkTime = Math.max(
			this.config.minDelayMs,
			Math.min(this.config.maxDelayMs, thinkTime),
		);

		// Emit thinking event
		if (this.config.emitThinkingEvents) {
			emit({
				type: 'ai_thinking',
				playerId,
				estimatedMs: clampedThinkTime,
			});
		}

		// Wait for "thinking" time
		await this.delay(clampedThinkTime);

		// Get brain decision
		const decision = await brain.decide(context);

		// Execute the decision
		await this.executeDecision(playerId, decision, execute, emit);

		// Update state
		playerState.isThinking = false;
		playerState.lastActionAt = Date.now();
		playerState.turnStep++;
		playerState.accumulatedThinkTime += clampedThinkTime;

		return decision;
	}

	/**
	 * Schedule an AI turn to execute after a delay.
	 *
	 * Returns a function to cancel the scheduled turn.
	 */
	scheduleTurn(
		playerId: string,
		getGameState: () => Promise<MultiplayerGameState | null>,
		execute: CommandExecutor,
		emit: EventEmitter,
		delayMs: number,
	): () => void {
		let cancelled = false;

		setTimeout(async () => {
			if (!cancelled) {
				await this.executeTurn(playerId, getGameState, execute, emit);
			}
		}, delayMs);

		return () => {
			cancelled = true;
		};
	}

	/**
	 * Clean up all resources.
	 */
	dispose(): void {
		for (const brain of this.brains.values()) {
			brain.dispose();
		}

		this.players.clear();
		this.brains.clear();
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	private buildGameContext(
		playerId: string,
		gameState: MultiplayerGameState,
	): GameContext {
		const player = gameState.players[playerId];

		if (!player) {
			throw new Error(`Player not in game: ${playerId}`);
		}

		// Build opponent scores
		const opponentScores = Object.values(gameState.players)
			.filter((p) => p.id !== playerId)
			.map((p) => ({
				playerId: p.id,
				scorecard: p.scorecard,
				totalScore: this.calculateTotal(p.scorecard),
			}));

		// Calculate score differential
		const myTotal = this.calculateTotal(player.scorecard);
		const leaderTotal = Math.max(myTotal, ...opponentScores.map((o: { playerId: string; scorecard: Scorecard; totalScore: number }) => o.totalScore));
		const scoreDifferential = myTotal - leaderTotal;

		// Note: dice may be null/undefined at turn start - brain must handle this
		return {
			dice: player.currentDice as [number, number, number, number, number],
			keptDice: player.keptDice ?? [false, false, false, false, false],
			rollsRemaining: player.rollsRemaining,
			scorecard: player.scorecard,
			round: gameState.roundNumber,
			opponentScores,
			isFinalRound: gameState.roundNumber === 13,
			scoreDifferential,
		};
	}

	private async executeDecision(
		playerId: string,
		decision: TurnDecision,
		execute: CommandExecutor,
		emit: EventEmitter,
	): Promise<void> {
		switch (decision.action) {
			case 'roll':
				emit({ type: 'ai_roll', playerId });
				await execute({ type: 'roll' });
				break;

			case 'keep':
				if (decision.keepMask) {
					emit({ type: 'ai_keep', playerId, keptDice: decision.keepMask });
					await execute({ type: 'keep', keepMask: decision.keepMask });
				}
				// After keeping, roll the dice
				emit({ type: 'ai_roll', playerId });
				await execute({ type: 'roll' });
				break;

			case 'score':
				if (decision.category) {
					emit({
						type: 'ai_score',
						playerId,
						category: decision.category,
						score: 0, // Will be filled in by game room
					});
					await execute({ type: 'score', category: decision.category });
				}
				break;
		}
	}

	private calculateTotal(scorecard: Scorecard): number {
		let total = 0;
		let upperSum = 0;

		const upperCats = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;

		for (const cat of upperCats) {
			const val = scorecard[cat];
			if (val !== null && val !== undefined) {
				total += val;
				upperSum += val;
			}
		}

		// Upper bonus
		if (upperSum >= 63) {
			total += 35;
		}

		const lowerCats = [
			'threeOfAKind',
			'fourOfAKind',
			'fullHouse',
			'smallStraight',
			'largeStraight',
			'dicee',
			'chance',
		] as const;

		for (const cat of lowerCats) {
			const val = scorecard[cat];
			if (val !== null && val !== undefined) {
				total += val;
			}
		}

		// Dicee bonus
		if (scorecard.diceeBonus !== null && scorecard.diceeBonus !== undefined) {
			total += scorecard.diceeBonus;
		}

		return total;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// ============================================================================
// Factory
// ============================================================================

let controllerInstance: AIController | null = null;

/**
 * Get the shared AI controller instance.
 */
export function getAIController(config?: Partial<AIControllerConfig>): AIController {
	if (!controllerInstance) {
		controllerInstance = new AIController(config);
	}
	return controllerInstance;
}

/**
 * Reset the controller (for testing).
 */
export function resetAIController(): void {
	if (controllerInstance) {
		controllerInstance.dispose();
		controllerInstance = null;
	}
}
