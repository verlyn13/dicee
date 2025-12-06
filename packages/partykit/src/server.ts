/**
 * Dicee Game Room Server
 *
 * PartyKit server for real-time multiplayer game rooms.
 * Handles room creation, player connections, and game state sync.
 */

import type * as Party from 'partykit/server';
import { verifySupabaseJWT } from './auth';
import {
	executeGameStart,
	generateStateSync,
	handleAfkTimeout,
	handleAfkWarning,
	handleKeepDice,
	handleRematch,
	handleRollDice,
	handleScoreCategory,
	handleStartGame,
	type GameEvent,
} from './game/handlers';
import { type AlarmData, GameStateManager } from './game/state';
import type { Category, KeptMask } from './game/types';
import { STARTING_COUNTDOWN_SECONDS } from './game/types';
import { parseCommand } from './schemas';
import {
	type ConnectionState,
	type RoomConfig,
	type RoomPlayer,
	type RoomState,
	createInitialRoomState,
} from './types';

// =============================================================================
// Storage Keys
// =============================================================================

const ROOM_STATE_KEY = 'room_state';

// =============================================================================
// Server Event Builders
// =============================================================================

function timestamp(): string {
	return new Date().toISOString();
}

function roomStateEvent(state: RoomState) {
	return JSON.stringify({
		type: 'room.state',
		timestamp: timestamp(),
		room: {
			code: state.code,
			config: state.config,
			state: state.status,
			players: state.players,
			hostId: state.hostId,
			createdAt: state.createdAt,
			startedAt: state.startedAt,
		},
	});
}

function playerJoinedEvent(player: RoomPlayer) {
	return JSON.stringify({
		type: 'player.joined',
		timestamp: timestamp(),
		player,
	});
}

function playerLeftEvent(playerId: string, reason: 'left' | 'disconnected' | 'kicked') {
	return JSON.stringify({
		type: 'player.left',
		timestamp: timestamp(),
		playerId,
		reason,
	});
}

function playerConnectionEvent(playerId: string, isConnected: boolean) {
	return JSON.stringify({
		type: 'player.connection',
		timestamp: timestamp(),
		playerId,
		isConnected,
	});
}

function gameStartingEvent(countdown: number) {
	return JSON.stringify({
		type: 'game.starting',
		timestamp: timestamp(),
		countdown,
	});
}

function gameStartedEvent(playerOrder: string[], currentPlayerId: string) {
	return JSON.stringify({
		type: 'game.started',
		timestamp: timestamp(),
		playerOrder,
		currentPlayerId,
	});
}

function errorEvent(message: string, code: string) {
	return JSON.stringify({
		type: 'error',
		timestamp: timestamp(),
		message,
		code,
	});
}

// =============================================================================
// GameRoom - Main PartyKit Server Class
// =============================================================================

/**
 * GameRoom - Main PartyKit server class
 *
 * Each room instance handles one game lobby/session.
 * Room ID is the 6-character room code.
 */
export default class GameRoom implements Party.Server {
	/** Cached room state */
	private state: RoomState | null = null;

	/** Game state manager for multiplayer game logic */
	private gameStateManager: GameStateManager;

	constructor(public room: Party.Room) {
		this.gameStateManager = new GameStateManager(room, room.id);
	}

	// =========================================================================
	// Authentication
	// =========================================================================

	/**
	 * Called before WebSocket connection is established.
	 * Verifies JWT using Supabase JWKS endpoint.
	 */
	static async onBeforeConnect(req: Request, lobby: Party.Lobby): Promise<Request | Response> {
		const url = new URL(req.url);
		const token = url.searchParams.get('token');

		if (!token) {
			return new Response('Unauthorized: No token provided', { status: 401 });
		}

		const supabaseUrl = lobby.env.SUPABASE_URL as string;
		if (!supabaseUrl) {
			console.error('[Auth] SUPABASE_URL not configured');
			return new Response('Server configuration error', { status: 500 });
		}

		const result = await verifySupabaseJWT(token, supabaseUrl);

		if (!result.success) {
			console.log(`[Auth] JWT verification failed: ${result.error}`);
			return new Response(`Unauthorized: ${result.error}`, { status: 401 });
		}

		// Attach verified user info to request headers
		const headers = new Headers(req.headers);
		headers.set('x-user-id', result.claims.sub);
		if (result.claims.email) {
			headers.set('x-user-email', result.claims.email);
		}
		if (result.claims.user_metadata?.display_name) {
			headers.set('x-user-display-name', result.claims.user_metadata.display_name);
		}

		return new Request(req.url, { headers });
	}

	// =========================================================================
	// Room State Management
	// =========================================================================

	/**
	 * Get room state, loading from storage if needed
	 */
	private async getState(): Promise<RoomState | null> {
		if (this.state) {
			return this.state;
		}

		const stored = await this.room.storage.get<RoomState>(ROOM_STATE_KEY);
		if (stored) {
			this.state = stored;
		}
		return this.state;
	}

	/**
	 * Save room state to durable storage
	 */
	private async saveState(): Promise<void> {
		if (this.state) {
			await this.room.storage.put(ROOM_STATE_KEY, this.state);
		}
	}

	/**
	 * Initialize room state if not exists
	 */
	private async initializeRoom(hostId: string, config?: Partial<RoomConfig>): Promise<RoomState> {
		const state = createInitialRoomState(this.room.id, hostId, config);
		this.state = state;
		await this.saveState();
		return state;
	}

	// =========================================================================
	// Connection Lifecycle
	// =========================================================================

	/**
	 * Called when a new WebSocket connection is established.
	 * JWT has already been verified by onBeforeConnect.
	 */
	async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
		const userId = ctx.request.headers.get('x-user-id');
		const email = ctx.request.headers.get('x-user-email') ?? undefined;
		const displayName = ctx.request.headers.get('x-user-display-name') ?? 'Player';

		if (!userId) {
			// Should not happen if onBeforeConnect works correctly
			conn.send(errorEvent('Authentication failed', 'AUTH_ERROR'));
			conn.close();
			return;
		}

		console.log(`[${this.room.id}] Player connecting: ${userId} (${displayName})`);

		// Store connection state
		const connState: ConnectionState = {
			userId,
			email,
			displayName,
			avatarSeed: userId, // Use userId as avatar seed by default
			connectedAt: timestamp(),
		};
		conn.setState(connState);

		// Get or create room state
		let state = await this.getState();

		if (!state) {
			// First connection - this player becomes host
			state = await this.initializeRoom(userId);
		}

		// Check if player is already in room
		const existingPlayer = state.players.find((p) => p.id === userId);

		if (existingPlayer) {
			// Reconnecting - update connection status
			existingPlayer.isConnected = true;
			existingPlayer.connectionId = conn.id;
			await this.saveState();

			// Notify others of reconnection
			this.room.broadcast(playerConnectionEvent(userId, true), [conn.id]);

			// If game is in progress, also update game state and send full sync
			if (state.status === 'playing') {
				await this.gameStateManager.updatePlayerConnection(userId, true, conn.id);
				await this.sendGameStateSync(conn);
			}
		} else {
			// New player joining
			if (state.players.length >= state.config.maxPlayers) {
				conn.send(errorEvent('Room is full', 'ROOM_FULL'));
				conn.close();
				return;
			}

			if (state.status !== 'waiting') {
				conn.send(errorEvent('Game already in progress', 'GAME_IN_PROGRESS'));
				conn.close();
				return;
			}

			// Add new player
			const newPlayer: RoomPlayer = {
				id: userId,
				displayName,
				avatarSeed: userId,
				isConnected: true,
				isHost: state.players.length === 0, // First player is host
				connectionId: conn.id,
				joinedAt: timestamp(),
			};

			// If this is the first player, they're the host
			if (state.players.length === 0) {
				state.hostId = userId;
			}

			state.players.push(newPlayer);
			await this.saveState();

			// Notify others of new player
			this.room.broadcast(playerJoinedEvent(newPlayer), [conn.id]);
		}

		// Send current state to connecting player
		conn.send(roomStateEvent(state));
	}

	/**
	 * Called when a WebSocket message is received.
	 */
	async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
		const connState = sender.state as ConnectionState | undefined;
		if (!connState?.userId) {
			sender.send(errorEvent('Not authenticated', 'AUTH_ERROR'));
			return;
		}

		// Parse message
		let raw: unknown;
		try {
			raw = typeof message === 'string' ? JSON.parse(message) : null;
		} catch {
			sender.send(errorEvent('Invalid JSON', 'PARSE_ERROR'));
			return;
		}

		// Validate command
		const result = parseCommand(raw);
		if (!result.success) {
			const firstIssue = result.error.issues[0];
			sender.send(errorEvent(firstIssue?.message ?? 'Invalid command', 'VALIDATION_ERROR'));
			return;
		}

		// Handle command
		await this.handleCommand(result.data, sender, connState);
	}

	/**
	 * Handle validated command
	 */
	private async handleCommand(
		command: ReturnType<typeof parseCommand>['data'] extends infer T ? (T extends { success: true } ? never : T) : never,
		sender: Party.Connection,
		connState: ConnectionState,
	): Promise<void> {
		// Type assertion since we know command is valid
		const cmd = command as { type: string; [key: string]: unknown };
		const state = await this.getState();

		if (!state) {
			sender.send(errorEvent('Room not initialized', 'ROOM_NOT_FOUND'));
			return;
		}

		switch (cmd.type) {
			case 'room.join': {
				// Update player display name if provided
				const player = state.players.find((p) => p.id === connState.userId);
				if (player && typeof cmd.displayName === 'string') {
					player.displayName = cmd.displayName;
					if (typeof cmd.avatarSeed === 'string') {
						player.avatarSeed = cmd.avatarSeed;
					}
					await this.saveState();

					// Broadcast updated state
					this.room.broadcast(roomStateEvent(state));
				}
				break;
			}

			case 'room.leave': {
				await this.removePlayer(connState.userId, 'left');
				sender.close();
				break;
			}

			case 'game.start': {
				// Only host can start
				if (state.hostId !== connState.userId) {
					sender.send(errorEvent('Only the host can start the game', 'NOT_HOST'));
					return;
				}

				// Need at least 2 players
				if (state.players.length < 2) {
					sender.send(errorEvent('Need at least 2 players to start', 'NOT_ENOUGH_PLAYERS'));
					return;
				}

				// Already started?
				if (state.status !== 'waiting') {
					sender.send(errorEvent('Game already started', 'GAME_IN_PROGRESS'));
					return;
				}

				// Initialize game state from room players
				await this.gameStateManager.initializeFromRoom(
					state.players.map((p) => ({
						id: p.id,
						displayName: p.displayName,
						avatarSeed: p.avatarSeed,
						isHost: p.isHost,
						connectionId: p.connectionId ?? '',
					})),
					{
						maxPlayers: state.config.maxPlayers as 2 | 3 | 4,
						turnTimeoutSeconds: 60,
						isPublic: state.config.isPublic,
					},
				);

				// Start countdown
				state.status = 'starting';
				await this.saveState();
				this.room.broadcast(gameStartingEvent(STARTING_COUNTDOWN_SECONDS));

				// Schedule game start alarm
				await this.gameStateManager.scheduleGameStart();
				break;
			}

			case 'dice.roll': {
				const kept = (cmd.kept ?? [false, false, false, false, false]) as KeptMask;
				const result = await handleRollDice(connState.userId, kept, this.gameStateManager);
				await this.processHandlerResult(result, sender);
				break;
			}

			case 'dice.keep': {
				const indices = (cmd.indices ?? []) as number[];
				const result = await handleKeepDice(connState.userId, indices, this.gameStateManager);
				await this.processHandlerResult(result, sender);
				break;
			}

			case 'category.score': {
				const category = cmd.category as Category;
				const result = await handleScoreCategory(connState.userId, category, this.gameStateManager);
				await this.processHandlerResult(result, sender);
				break;
			}

			case 'game.rematch': {
				const result = await handleRematch(connState.userId, this.gameStateManager);
				await this.processHandlerResult(result, sender);
				break;
			}

			default: {
				sender.send(errorEvent(`Unknown command: ${cmd.type}`, 'UNKNOWN_COMMAND'));
			}
		}
	}

	/**
	 * Remove a player from the room
	 */
	private async removePlayer(userId: string, reason: 'left' | 'disconnected' | 'kicked'): Promise<void> {
		const state = await this.getState();
		if (!state) return;

		const playerIndex = state.players.findIndex((p) => p.id === userId);
		if (playerIndex === -1) return;

		const wasHost = state.players[playerIndex].isHost;
		state.players.splice(playerIndex, 1);

		// If host left and players remain, assign new host
		if (wasHost && state.players.length > 0) {
			state.players[0].isHost = true;
			state.hostId = state.players[0].id;
		}

		// If no players left, mark room as abandoned
		if (state.players.length === 0) {
			state.status = 'abandoned';
		}

		await this.saveState();

		// Notify remaining players
		this.room.broadcast(playerLeftEvent(userId, reason));

		// Send updated state
		if (state.players.length > 0) {
			this.room.broadcast(roomStateEvent(state));
		}
	}

	/**
	 * Called when a WebSocket connection is closed.
	 */
	async onClose(conn: Party.Connection) {
		const connState = conn.state as ConnectionState | undefined;
		if (!connState?.userId) return;

		console.log(`[${this.room.id}] Player disconnected: ${connState.userId}`);

		const state = await this.getState();
		if (!state) return;

		const player = state.players.find((p) => p.id === connState.userId);
		if (!player) return;

		// Mark as disconnected (don't remove yet - allow reconnection)
		player.isConnected = false;
		player.connectionId = undefined;
		await this.saveState();

		// Notify others
		this.room.broadcast(playerConnectionEvent(connState.userId, false));

		// If in waiting state, remove after timeout (allow reconnection window)
		if (state.status === 'waiting') {
			setTimeout(async () => {
				const currentState = await this.getState();
				if (!currentState) return;

				const currentPlayer = currentState.players.find((p) => p.id === connState.userId);
				if (currentPlayer && !currentPlayer.isConnected) {
					// Still disconnected - remove from room
					await this.removePlayer(connState.userId, 'disconnected');
				}
			}, 30000); // 30 second reconnection window
		}
	}

	/**
	 * Called when a WebSocket error occurs.
	 */
	async onError(conn: Party.Connection, error: Error) {
		const connState = conn.state as ConnectionState | undefined;
		console.error(`[${this.room.id}] Connection error for ${connState?.userId ?? conn.id}:`, error);
	}

	// =========================================================================
	// Alarm Handler
	// =========================================================================

	/**
	 * Called when a scheduled alarm fires.
	 * Handles game start countdown, AFK warnings, and timeouts.
	 */
	async onAlarm() {
		const alarmData = await this.gameStateManager.getAlarmData();
		if (!alarmData) {
			console.log(`[${this.room.id}] Alarm fired but no alarm data found`);
			return;
		}

		console.log(`[${this.room.id}] Alarm fired: ${alarmData.type}`);

		switch (alarmData.type) {
			case 'game_start': {
				// Execute the actual game start
				const result = await executeGameStart(this.gameStateManager);
				await this.processHandlerResult(result);

				// Update room status
				const roomState = await this.getState();
				if (roomState) {
					roomState.status = 'playing';
					roomState.startedAt = timestamp();
					await this.saveState();
				}
				break;
			}

			case 'afk_warning': {
				if (alarmData.playerId) {
					const result = await handleAfkWarning(alarmData.playerId, this.gameStateManager);
					await this.processHandlerResult(result);

					// Schedule the actual timeout
					await this.gameStateManager.scheduleAfkTimeout(alarmData.playerId);
				}
				break;
			}

			case 'afk_timeout': {
				if (alarmData.playerId) {
					const result = await handleAfkTimeout(alarmData.playerId, this.gameStateManager);
					await this.processHandlerResult(result);
				}
				break;
			}

			case 'room_cleanup': {
				// Check if room should be cleaned up
				const roomState = await this.getState();
				if (roomState) {
					const connectedPlayers = roomState.players.filter((p) => p.isConnected);
					if (connectedPlayers.length === 0) {
						console.log(`[${this.room.id}] Room cleanup: no connected players, marking abandoned`);
						roomState.status = 'abandoned';
						await this.saveState();
					}
				}
				break;
			}
		}
	}

	// =========================================================================
	// Handler Result Processing
	// =========================================================================

	/**
	 * Process handler result - broadcast/reply events and manage alarms
	 */
	private async processHandlerResult(
		result: {
			broadcast?: GameEvent[];
			reply?: GameEvent[];
			scheduleAfkAlarm?: boolean;
			cancelAlarm?: boolean;
		},
		sender?: Party.Connection,
	): Promise<void> {
		// Cancel existing alarm if requested
		if (result.cancelAlarm) {
			await this.gameStateManager.cancelAlarm();
		}

		// Broadcast events to all connections
		if (result.broadcast) {
			for (const event of result.broadcast) {
				this.room.broadcast(JSON.stringify(event));
			}
		}

		// Reply events to sender only
		if (result.reply && sender) {
			for (const event of result.reply) {
				sender.send(JSON.stringify(event));
			}
		}

		// Schedule AFK alarm if requested
		if (result.scheduleAfkAlarm) {
			const gameState = await this.gameStateManager.getState();
			if (gameState && gameState.phase !== 'game_over') {
				const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
				if (currentPlayerId) {
					await this.gameStateManager.scheduleAfkWarning(currentPlayerId);
				}
			}
		}
	}

	// =========================================================================
	// State Sync for Reconnection
	// =========================================================================

	/**
	 * Send full game state to a reconnecting player
	 */
	private async sendGameStateSync(conn: Party.Connection): Promise<void> {
		const syncEvent = await generateStateSync(this.gameStateManager);
		if (syncEvent) {
			conn.send(JSON.stringify(syncEvent));
		}
	}
}
