/**
 * GameRoom AI Integration
 *
 * Handles AI player turns within a game room.
 * This module bridges the AIController with GameRoom operations.
 *
 * Usage in GameRoom:
 * ```typescript
 * import { AIRoomManager } from './ai/gameroom-integration';
 *
 * // In constructor or initialization
 * private aiManager = new AIRoomManager();
 *
 * // After TURN_CHANGED, check for AI turn
 * if (this.aiManager.isAIPlayer(nextPlayerId)) {
 *   await this.aiManager.executeAITurn(nextPlayerId, gameState, this.executeCommand.bind(this));
 * }
 * ```
 */

import type { MultiplayerGameState, PlayerGameState } from '../game';
import { type AICommand, AIController } from './controller';
import { getProfile } from './profiles';
import type { AIEvent } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback to execute game commands (roll, keep, score).
 */
export type GameCommandExecutor = (playerId: string, command: AICommand) => Promise<void>;

/**
 * Callback to broadcast events to clients.
 */
export type EventBroadcaster = (event: { type: string; payload: Record<string, unknown> }) => void;

// ============================================================================
// AI Room Manager
// ============================================================================

/**
 * Manages AI players within a single game room.
 */
export class AIRoomManager {
	private controller: AIController;
	private aiPlayers: Set<string> = new Set();
	private turnInProgress = false;

	constructor() {
		this.controller = new AIController({
			minDelayMs: 800,
			maxDelayMs: 8000,
			enableChat: true,
			emitThinkingEvents: true,
		});
	}

	/**
	 * Initialize the manager.
	 */
	async initialize(): Promise<void> {
		await this.controller.initialize();
	}

	/**
	 * Add an AI player to the room.
	 *
	 * @param playerId - The player ID
	 * @param profileId - The AI profile ID
	 */
	async addAIPlayer(playerId: string, profileId: string): Promise<void> {
		const profile = getProfile(profileId);
		if (!profile) {
			throw new Error(`Unknown AI profile: ${profileId}`);
		}

		await this.controller.addPlayer(playerId, profile);
		this.aiPlayers.add(playerId);
	}

	/**
	 * Remove an AI player from the room.
	 */
	removeAIPlayer(playerId: string): void {
		this.controller.removePlayer(playerId);
		this.aiPlayers.delete(playerId);
	}

	/**
	 * Check if a player is an AI.
	 */
	isAIPlayer(playerId: string): boolean {
		return this.aiPlayers.has(playerId);
	}

	/**
	 * Get all AI player IDs.
	 */
	getAIPlayerIds(): string[] {
		return Array.from(this.aiPlayers);
	}

	/**
	 * Check if there are any AI players.
	 */
	hasAIPlayers(): boolean {
		return this.aiPlayers.size > 0;
	}

	/**
	 * Execute an AI player's complete turn.
	 *
	 * @param playerId - The AI player ID
	 * @param getGameState - Function to get fresh game state (called each step)
	 * @param executeCommand - Callback to execute game commands
	 * @param broadcast - Callback to broadcast events
	 */
	async executeAITurn(
		playerId: string,
		getGameState: () => Promise<MultiplayerGameState | null>,
		executeCommand: GameCommandExecutor,
		broadcast: EventBroadcaster,
	): Promise<void> {
		console.log(`[AIRoomManager] executeAITurn called for ${playerId}`);
		console.log(`[AIRoomManager] AI players registered: ${Array.from(this.aiPlayers).join(', ')}`);

		if (!this.isAIPlayer(playerId)) {
			console.error(`[AIRoomManager] Player ${playerId} is not registered as AI`);
			throw new Error(`Player ${playerId} is not an AI`);
		}

		if (this.turnInProgress) {
			console.warn(`[AIRoomManager] AI turn already in progress, skipping turn for ${playerId}`);
			return;
		}

		this.turnInProgress = true;
		console.log(`[AIRoomManager] Starting AI turn for ${playerId}`);

		try {
			// Create command executor wrapper
			const executor = async (command: AICommand) => {
				console.log(`[AIRoomManager] Executing command: ${command.type}`);
				await executeCommand(playerId, command);
			};

			// Create event emitter wrapper
			const emitter = (event: AIEvent) => {
				console.log(`[AIRoomManager] Emitting event: ${event.type}`);
				this.handleAIEvent(event, broadcast);
			};

			// Execute the turn with state getter
			await this.controller.executeTurn(playerId, getGameState, executor, emitter);
			console.log(`[AIRoomManager] AI turn completed for ${playerId}`);
		} catch (error) {
			console.error(`[AIRoomManager] AI turn failed for ${playerId}:`, error);
			throw error;
		} finally {
			this.turnInProgress = false;
			console.log(`[AIRoomManager] turnInProgress reset to false`);
		}
	}

	/**
	 * Check if an AI turn is currently in progress.
	 */
	isTurnInProgress(): boolean {
		return this.turnInProgress;
	}

	/**
	 * Clean up all resources.
	 */
	dispose(): void {
		this.controller.dispose();
		this.aiPlayers.clear();
		this.turnInProgress = false;
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	private handleAIEvent(event: AIEvent, broadcast: EventBroadcaster): void {
		switch (event.type) {
			case 'ai_thinking':
				broadcast({
					type: 'AI_THINKING',
					payload: {
						playerId: event.playerId,
						estimatedMs: event.estimatedMs,
					},
				});
				break;

			case 'ai_roll':
				// Roll is handled by executeCommand, but we can emit thinking feedback
				broadcast({
					type: 'AI_ROLLING',
					payload: {
						playerId: event.playerId,
					},
				});
				break;

			case 'ai_keep':
				broadcast({
					type: 'AI_KEEPING',
					payload: {
						playerId: event.playerId,
						keptDice: event.keptDice,
					},
				});
				break;

			case 'ai_score':
				broadcast({
					type: 'AI_SCORING',
					payload: {
						playerId: event.playerId,
						category: event.category,
					},
				});
				break;

			case 'ai_chat':
				broadcast({
					type: 'CHAT_MESSAGE',
					payload: {
						id: crypto.randomUUID(),
						userId: event.playerId,
						content: event.message,
						timestamp: Date.now(),
						isAI: true,
					},
				});
				break;

			case 'ai_reaction':
				broadcast({
					type: 'CHAT_REACTION',
					payload: {
						userId: event.playerId,
						reaction: event.reaction,
						isAI: true,
					},
				});
				break;
		}
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a PlayerGameState for an AI player.
 */
export function createAIPlayerState(playerId: string, profileId: string): Partial<PlayerGameState> {
	const profile = getProfile(profileId);

	if (!profile) {
		throw new Error(`Unknown AI profile: ${profileId}`);
	}

	return {
		id: playerId,
		displayName: profile.name,
		avatarSeed: profile.avatarSeed,
		type: 'ai',
		aiProfileId: profileId,
		isConnected: true, // AI is always "connected"
		connectionId: null, // AI has no WebSocket connection
		connectionStatus: 'online', // AI is always "online"
		isHost: false, // AI can't be host
	};
}

/**
 * Check if a player state represents an AI player.
 */
export function isAIPlayerState(player: PlayerGameState): boolean {
	return player.type === 'ai';
}

/**
 * Get the AI profile for a player.
 */
export function getAIProfileForPlayer(player: PlayerGameState) {
	if (player.type !== 'ai' || !player.aiProfileId) {
		return null;
	}

	return getProfile(player.aiProfileId);
}
