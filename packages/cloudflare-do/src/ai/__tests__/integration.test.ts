/**
 * AI Integration Tests
 *
 * Tests the full AI turn execution flow from AIRoomManager through AIController.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIRoomManager } from '../gameroom-integration';
import type { MultiplayerGameState, PlayerGameState } from '../../game';
import { createPlayerGameState } from '../../game';

function createTestPlayer(id: string, displayName: string, type: 'human' | 'ai' = 'human'): PlayerGameState {
	return createPlayerGameState(
		id,
		displayName,
		`${id}-seed`,
		false,
		id,
		type,
		type === 'ai' ? 'carmen' : undefined,
	);
}

function createTestGameState(currentPlayerId: string, players: PlayerGameState[]): MultiplayerGameState {
	const playerRecords: Record<string, PlayerGameState> = {};
	for (const p of players) {
		playerRecords[p.id] = p;
	}

	return {
		roomCode: 'TEST01',
		phase: 'turn_roll',
		playerOrder: players.map((p) => p.id),
		currentPlayerIndex: players.findIndex((p) => p.id === currentPlayerId),
		turnNumber: 1,
		roundNumber: 1,
		players: playerRecords,
		turnStartedAt: new Date().toISOString(),
		gameStartedAt: new Date().toISOString(),
		gameCompletedAt: null,
		rankings: null,
		config: {
			maxPlayers: 4,
			turnTimeoutSeconds: 0,
			isPublic: false,
		},
	};
}

describe('AIRoomManager Integration', () => {
	let aiManager: AIRoomManager;

	beforeEach(async () => {
		aiManager = new AIRoomManager();
		await aiManager.initialize();
	});

	describe('AI Player Registration', () => {
		it('should register AI player correctly', async () => {
			const aiPlayerId = 'ai:carmen:123456';
			await aiManager.addAIPlayer(aiPlayerId, 'carmen');

			expect(aiManager.isAIPlayer(aiPlayerId)).toBe(true);
			expect(aiManager.hasAIPlayers()).toBe(true);
			expect(aiManager.getAIPlayerIds()).toContain(aiPlayerId);
		});

		it('should not identify human player as AI', async () => {
			const humanPlayerId = 'human:player1';
			expect(aiManager.isAIPlayer(humanPlayerId)).toBe(false);
		});
	});

	describe('AI Turn Execution', () => {
		it('should execute a complete AI turn', async () => {
			const aiPlayerId = 'ai:carmen:123456';
			await aiManager.addAIPlayer(aiPlayerId, 'carmen');

			const humanPlayer = createTestPlayer('human:player1', 'Human', 'human');
			const aiPlayer = createTestPlayer(aiPlayerId, 'Carmen', 'ai');

			// Start with AI player's turn, no dice yet
			let gameState = createTestGameState(aiPlayerId, [humanPlayer, aiPlayer]);

			const commands: Array<{ playerId: string; type: string }> = [];
			const events: Array<{ type: string }> = [];

			// Mock the execute command to update game state
			const executeCommand = vi.fn(async (playerId: string, command: { type: string }) => {
				commands.push({ playerId, type: command.type });

				// Simulate the command execution
				if (command.type === 'roll') {
					// Update game state with dice
					gameState = {
						...gameState,
						phase: 'turn_decide',
						players: {
							...gameState.players,
							[playerId]: {
								...gameState.players[playerId],
								currentDice: [3, 3, 2, 5, 6] as [number, number, number, number, number],
								keptDice: [false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean],
								rollsRemaining: gameState.players[playerId].rollsRemaining - 1,
							},
						},
					};
				} else if (command.type === 'score') {
					// Score was recorded
					gameState = {
						...gameState,
						phase: 'turn_roll',
					};
				}
			});

			const broadcast = vi.fn((event: { type: string }) => {
				events.push(event);
			});

			// Execute the AI turn
			await aiManager.executeAITurn(
				aiPlayerId,
				async () => gameState,
				executeCommand,
				broadcast,
			);

			// Verify commands were executed
			expect(commands.length).toBeGreaterThan(0);

			// First command should be a roll (since no dice exist)
			expect(commands[0].type).toBe('roll');

			// Last command should be a score
			const lastCommand = commands[commands.length - 1];
			expect(lastCommand.type).toBe('score');

			// Verify events were broadcast
			expect(events.length).toBeGreaterThan(0);
		}, 30000); // 30 second timeout for AI thinking delays

		it('should handle AI turn when dice already exist', async () => {
			const aiPlayerId = 'ai:carmen:123456';
			await aiManager.addAIPlayer(aiPlayerId, 'carmen');

			const humanPlayer = createTestPlayer('human:player1', 'Human', 'human');
			const aiPlayer: PlayerGameState = {
				...createTestPlayer(aiPlayerId, 'Carmen', 'ai'),
				currentDice: [1, 1, 1, 1, 1] as [number, number, number, number, number], // Dicee!
				keptDice: [false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean],
				rollsRemaining: 2,
			};

			let gameState = createTestGameState(aiPlayerId, [humanPlayer, aiPlayer]);
			gameState.phase = 'turn_decide';

			const commands: Array<{ playerId: string; type: string }> = [];

			const executeCommand = vi.fn(async (playerId: string, command: { type: string }) => {
				commands.push({ playerId, type: command.type });
			});

			const broadcast = vi.fn();

			await aiManager.executeAITurn(
				aiPlayerId,
				async () => gameState,
				executeCommand,
				broadcast,
			);

			// With a Dicee, AI should score immediately
			expect(commands.some((c) => c.type === 'score')).toBe(true);
		}, 30000);

		it('should not execute turn for non-AI player', async () => {
			const humanPlayerId = 'human:player1';

			await expect(
				aiManager.executeAITurn(
					humanPlayerId,
					async () => null,
					vi.fn(),
					vi.fn(),
				),
			).rejects.toThrow('not an AI');
		});
	});
});
