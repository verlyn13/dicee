/**
 * GameRoom Durable Object
 *
 * Handles multiplayer game room logic with hibernatable WebSockets.
 * This is the core game server - manages connections, game state, and broadcasts.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, ConnectionState, RoomState, PlayerInfo, SpectatorInfo, AlarmData, ConnectionRole, RoomStatusUpdate, PlayerSummary, GameHighlight, Prediction, PredictionType, PredictionResult, SpectatorPredictionStats, RootingChoice, PlayerRootingInfo, RootingUpdate, KibitzVote, KibitzVoteType, KibitzOption, KibitzState, KibitzUpdate, SpectatorReactionEmoji, SpectatorReaction, SpectatorReactionEvent, ReactionRateLimit, ReactionCombo, JoinQueueEntry, JoinQueueState, JoinQueueUpdate, WarmSeatTransition, GalleryPoints, GalleryStats, GalleryAchievementId } from './types';
import { REACTION_METADATA, STANDARD_REACTIONS, SPECTATOR_REACTIONS, ROOTING_REACTIONS, DEFAULT_REACTION_RATE_LIMIT, WARM_SEAT_COUNTDOWN_SECONDS, MAX_QUEUE_SIZE, GALLERY_POINT_VALUES, GALLERY_ACHIEVEMENTS, createEmptyGalleryPoints, calculateTotalPoints } from './types';
import { createInitialRoomState } from './types';
import { GlobalLobby } from './GlobalLobby';
import {
	GameStateManager,
	canRollDice,
	canKeepDice,
	canScoreCategory,
	canRematch,
	type Category,
	type KeptMask,
	type MultiplayerGameState,
} from './game';
import {
	ChatManager,
	validateChatMessage,
	isChatMessageType,
	createChatMessageResponse,
	createChatHistoryResponse,
	createReactionUpdateResponse,
	createTypingUpdateResponse,
	createChatErrorResponse,
	type QuickChatKey,
	type ReactionEmoji,
} from './chat';
import { verifySupabaseJWT, extractDisplayName, extractAvatarUrl } from './auth';
import { createAIPlayerState, getProfile, AIRoomManager, type AICommand } from './ai';

/**
 * GameRoom Durable Object - manages a single multiplayer game room
 *
 * Key features:
 * - Hibernatable WebSockets (pay only when processing, not connection duration)
 * - SQLite storage for game state persistence
 * - Tag-based connection filtering for targeted broadcasts
 * - Alarm-based turn timeouts and cleanup
 */
export class GameRoom extends DurableObject<Env> {
	/** Chat manager for lobby chat system */
	private chatManager: ChatManager;

	/** Game state manager for core game loop */
	private gameStateManager: GameStateManager;

	/** Stub for GlobalLobby DO for RPC calls */
	private lobbyStub: DurableObjectStub<GlobalLobby>;

	/** Gallery predictions for current turn (key: `${turnNumber}:${playerId}`) */
	private predictions: Map<string, Prediction[]> = new Map();

	/** Spectator prediction stats (key: spectatorId) */
	private spectatorStats: Map<string, SpectatorPredictionStats> = new Map();

	/** Current turn tracking for predictions */
	private currentTurn: { turnNumber: number; playerId: string } | null = null;

	/** Rooting choices (key: spectatorId, value: RootingChoice) */
	private rootingChoices: Map<string, RootingChoice> = new Map();

	/** Kibitz votes for current turn (key: spectatorId, value: KibitzVote) */
	private kibitzVotes: Map<string, KibitzVote> = new Map();

	/** Spectator reaction rate limits (key: spectatorId, value: ReactionRateLimit) */
	private reactionRateLimits: Map<string, ReactionRateLimit> = new Map();

	/** Recent reactions for combo tracking (key: emoji, value: timestamps and spectators) */
	private recentReactions: Map<SpectatorReactionEmoji, { timestamp: number; spectatorId: string }[]> = new Map();

	/** Combo window in milliseconds */
	private static readonly REACTION_COMBO_WINDOW_MS = 3000;

	/** Join queue for next game (D8) */
	private joinQueue: JoinQueueEntry[] = [];

	/** Warm seat transition state (D8) */
	private warmSeatTransition: WarmSeatTransition | null = null;

	/** Gallery points per spectator for current game (D9) */
	private gameGalleryPoints: Map<string, GalleryPoints> = new Map();

	/** Per-game point caps tracking (D9) */
	private gamePointCaps: Map<string, { reactions: number; chat: number }> = new Map();

	/** AI Room Manager for handling AI player turns */
	private aiManager: AIRoomManager;

	/** Maximum predictions per spectator per turn */
	private static readonly MAX_PREDICTIONS_PER_TURN = 3;

	/** Maximum rooting changes per game (rate limiting) */
	private static readonly MAX_ROOTING_CHANGES = 5;

	/** Prediction points by type */
	private static readonly PREDICTION_POINTS = {
		dicee: 50,    // Highest risk/reward
		exact: 25,    // Exact score match
		improves: 10, // Player improves their position
		bricks: 10,   // Player gets nothing/minimal
	} as const;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize chat manager
		this.chatManager = new ChatManager(ctx);

		// Initialize game state manager (room code will be set from ctx.id.name)
		const roomCode = ctx.id.name ?? 'UNKNOWN';
		this.gameStateManager = new GameStateManager(ctx, roomCode);

		// Get stub for GlobalLobby (singleton)
		const lobbyId = env.GLOBAL_LOBBY.idFromName('global');
		this.lobbyStub = env.GLOBAL_LOBBY.get(lobbyId) as DurableObjectStub<GlobalLobby>;

		// Set up auto-response for ping/pong without waking the DO
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

		// Initialize AI room manager
		this.aiManager = new AIRoomManager();
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// HTTP/WebSocket Entry Point
	// ─────────────────────────────────────────────────────────────────────────────

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// WebSocket upgrade request
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleWebSocketUpgrade(request, url);
		}

		// HTTP endpoints
		if (request.method === 'GET' && url.pathname.endsWith('/info')) {
			return this.handleRoomInfo();
		}

		return new Response('Method Not Allowed', { status: 405 });
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// WebSocket Upgrade with Authentication
	// ─────────────────────────────────────────────────────────────────────────────

	private async handleWebSocketUpgrade(_request: Request, url: URL): Promise<Response> {
		// Extract JWT from query params
		const token = url.searchParams.get('token');
		if (!token) {
			return new Response('Missing token', { status: 401 });
		}

		// Extract role from query params (default to player)
		const roleParam = url.searchParams.get('role');
		const role: ConnectionRole = roleParam === 'spectator' ? 'spectator' : 'player';

		// Check if room allows spectators (if spectator role requested)
		if (role === 'spectator') {
			const roomState = await this.ctx.storage.get<RoomState>('room');
			if (roomState && !roomState.settings.allowSpectators) {
				return new Response('Spectators not allowed in this room', { status: 403 });
			}
		}

		// Verify JWT - tries JWKS first (ES256), falls back to HS256 if secret provided
		const authResult = await verifySupabaseJWT(token, this.env.SUPABASE_URL, this.env.SUPABASE_JWT_SECRET);
		if (!authResult.success) {
			// Return appropriate error based on failure reason
			const statusCode = authResult.code === 'EXPIRED' ? 401 : authResult.code === 'JWKS_ERROR' ? 503 : 401;
			return new Response(authResult.error, { status: statusCode });
		}

		// Extract user info from verified claims
		const userId = authResult.claims.sub;
		const displayName = extractDisplayName(authResult.claims);
		const avatarUrl = extractAvatarUrl(authResult.claims);

		// Create WebSocket pair
		const { 0: clientSocket, 1: serverSocket } = new WebSocketPair();

		// Accept with hibernation enabled
		// Tags allow filtering connections: getWebSockets('user:abc123'), getWebSockets('spectator:room')
		const roomCode = this.getRoomCode();
		const tags = [`user:${userId}`, `room:${roomCode}`, `role:${role}`];
		if (role === 'spectator') {
			tags.push(`spectator:${roomCode}`);
		} else {
			tags.push(`player:${roomCode}`);
		}
		this.ctx.acceptWebSocket(serverSocket, tags);

		// Attach state that survives hibernation
		const connectionState: ConnectionState = {
			userId,
			displayName,
			avatarSeed: avatarUrl ?? userId,
			connectedAt: Date.now(),
			isHost: false,
			role,
		};
		serverSocket.serializeAttachment(connectionState);

		// Handle connection setup in background
		this.ctx.waitUntil(this.onConnect(serverSocket, connectionState));

		// Return 101 Switching Protocols
		return new Response(null, { status: 101, webSocket: clientSocket });
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Hibernatable WebSocket Handlers
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Called when WebSocket receives a message.
	 * If DO was hibernated, it wakes up, deserializes state, handles message.
	 */
	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') {
			ws.close(1003, 'Binary messages not supported');
			return;
		}

		// Recover connection state after potential hibernation
		const connState = ws.deserializeAttachment() as ConnectionState;

		try {
			const parsed = JSON.parse(message) as { type: string; payload?: unknown };
			await this.handleMessage(ws, connState, parsed);
		} catch {
			this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
		}
	}

	/**
	 * Called when WebSocket closes (client disconnect or error).
	 */
	async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
		const connState = ws.deserializeAttachment() as ConnectionState;
		await this.onDisconnect(connState, code, reason);
	}

	/**
	 * Called on WebSocket error.
	 */
	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		const connState = ws.deserializeAttachment() as ConnectionState;
		console.error(`WebSocket error for ${connState.userId}:`, error);
		await this.onDisconnect(connState, 1011, 'Internal error');
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Alarm Handler
	// ─────────────────────────────────────────────────────────────────────────────

	async alarm(): Promise<void> {
		const alarmData = await this.ctx.storage.get<AlarmData>('alarm_data');
		if (!alarmData) return;

		switch (alarmData.type) {
			case 'TURN_TIMEOUT':
				await this.handleTurnTimeout(alarmData.userId);
				break;
			case 'AFK_CHECK':
				await this.handleAfkCheck(alarmData.userId);
				break;
			case 'ROOM_CLEANUP':
				await this.handleRoomCleanup();
				break;
		}

		await this.ctx.storage.delete('alarm_data');
	}

	/**
	 * Handle turn timeout - auto-score the lowest available category
	 */
	private async handleTurnTimeout(userId: string | undefined): Promise<void> {
		if (!userId) return;

		const gameState = await this.gameStateManager.getState();
		if (!gameState) return;

		// Verify this player is still the current player
		const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
		if (currentPlayerId !== userId) return;

		// Skip the turn with auto-scoring
		const result = await this.gameStateManager.skipTurn(userId, 'timeout');

		// Broadcast the auto-score
		this.broadcast({
			type: 'TURN_SKIPPED',
			payload: {
				playerId: userId,
				reason: 'timeout',
				category: result.categoryScored,
				score: result.score,
			},
		});

		// Also send to spectators
		this.broadcastToSpectators({
			type: 'TURN_SKIPPED',
			payload: {
				playerId: userId,
				reason: 'timeout',
				category: result.categoryScored,
				score: result.score,
			},
		});

		// Handle game completion or turn advancement
		if (result.gameCompleted) {
			this.handleGameOver(result.rankings);
		} else if (result.nextPlayerId) {
			// Broadcast turn change
			this.broadcast({
				type: 'TURN_CHANGED',
				payload: {
					currentPlayerId: result.nextPlayerId,
					phase: result.nextPhase,
				},
			});

			this.broadcastToSpectators({
				type: 'TURN_CHANGED',
				payload: {
					currentPlayerId: result.nextPlayerId,
					phase: result.nextPhase,
				},
			});

			// Schedule timeout for next player
			const roomState = await this.ctx.storage.get<RoomState>('room');
			if (roomState?.settings.turnTimeoutSeconds && roomState.settings.turnTimeoutSeconds > 0) {
				await this.gameStateManager.scheduleAfkWarning(result.nextPlayerId);
			}
		}

		await this.notifyLobbyOfUpdate();
	}

	/**
	 * Handle AFK check - mark player as disconnected and potentially skip turn
	 */
	private async handleAfkCheck(userId: string | undefined): Promise<void> {
		if (!userId) return;

		// Check if user has reconnected
		const userConnections = this.ctx.getWebSockets(`user:${userId}`);
		if (userConnections.length > 0) {
			// User reconnected, cancel AFK
			return;
		}

		// Update player connection status
		await this.gameStateManager.updatePlayerConnection(userId, false);

		// Broadcast player status change
		this.broadcast({
			type: 'PLAYER_AFK',
			payload: {
				userId,
				status: 'disconnected',
			},
		});

		// Check if this player's turn - if so, skip it
		const gameState = await this.gameStateManager.getState();
		if (gameState) {
			const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
			if (currentPlayerId === userId) {
				// Skip their turn
				await this.handleTurnTimeout(userId);
			}
		}
	}

	/**
	 * Handle room cleanup - close room if abandoned
	 */
	private async handleRoomCleanup(): Promise<void> {
		const connectedPlayers = this.getConnectedUserIds();

		if (connectedPlayers.length === 0) {
			// No players left, clean up room
			const roomState = await this.ctx.storage.get<RoomState>('room');
			if (roomState) {
				roomState.status = 'abandoned';
				await this.ctx.storage.put('room', roomState);
			}

			// Notify lobby that room is gone
			await this.notifyLobbyOfUpdate();

			// Close all spectator connections
			const roomCode = this.getRoomCode();
			for (const ws of this.ctx.getWebSockets(`spectator:${roomCode}`)) {
				ws.close(1000, 'Room abandoned');
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Helper Methods
	// ─────────────────────────────────────────────────────────────────────────────

	private getRoomCode(): string {
		// Extract from DO ID (set via idFromName in worker)
		return this.ctx.id.name ?? 'UNKNOWN';
	}

	/**
	 * Broadcast message to all connected WebSockets.
	 */
	private broadcast(message: object, exclude?: WebSocket): void {
		const allSockets = this.ctx.getWebSockets();
		const msgType = (message as { type?: string }).type ?? 'unknown';
		let sentCount = 0;

		const payload = JSON.stringify(message);
		for (const ws of allSockets) {
			if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
				ws.send(payload);
				sentCount++;
			}
		}

		console.log(`[Broadcast] ${msgType} → ${sentCount}/${allSockets.length} sockets`);
	}

	/**
	 * Broadcast message to players only (exclude spectators).
	 */
	private broadcastToPlayers(message: object, exclude?: WebSocket): void {
		const payload = JSON.stringify(message);
		const roomCode = this.getRoomCode();
		for (const ws of this.ctx.getWebSockets(`player:${roomCode}`)) {
			if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
				ws.send(payload);
			}
		}
	}

	/**
	 * Broadcast message to spectators only.
	 */
	private broadcastToSpectators(message: object): void {
		const payload = JSON.stringify(message);
		const roomCode = this.getRoomCode();
		for (const ws of this.ctx.getWebSockets(`spectator:${roomCode}`)) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(payload);
			}
		}
	}

	/**
	 * Send to specific user by ID.
	 */
	private sendToUser(userId: string, message: object): void {
		const payload = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets(`user:${userId}`)) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(payload);
			}
		}
	}

	/**
	 * Send error response.
	 */
	private sendError(ws: WebSocket, code: string, message: string): void {
		ws.send(JSON.stringify({ type: 'ERROR', payload: { code, message } }));
	}

	/**
	 * Get all connected player user IDs (excludes spectators).
	 */
	private getConnectedUserIds(): string[] {
		const userIds = new Set<string>();
		const roomCode = this.getRoomCode();
		for (const ws of this.ctx.getWebSockets(`player:${roomCode}`)) {
			const state = ws.deserializeAttachment() as ConnectionState;
			userIds.add(state.userId);
		}
		return Array.from(userIds);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// GlobalLobby Notifications
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Notify GlobalLobby of room status changes.
	 * Call on: player join/leave, spectator join/leave, game start, round change, game end.
	 */
	private async notifyLobbyOfUpdate(): Promise<void> {
		try {
			const roomState = await this.ctx.storage.get<RoomState>('room');
			if (!roomState) return;

			// Get host info
			const hostConnection = this.ctx.getWebSockets(`user:${roomState.hostUserId}`)[0];
			const hostState = hostConnection?.deserializeAttachment() as ConnectionState | undefined;

			// Build player summaries
			const players: PlayerSummary[] = [];
			const roomCode = this.getRoomCode();
			for (const ws of this.ctx.getWebSockets(`player:${roomCode}`)) {
				const state = ws.deserializeAttachment() as ConnectionState;
				players.push({
					userId: state.userId,
					displayName: state.displayName,
					avatarSeed: state.avatarSeed,
					score: 0, // TODO: Get actual score from game state
					isHost: state.isHost,
				});
			}

			// Map room status to lobby status
			const lobbyStatus: 'waiting' | 'playing' | 'finished' =
				roomState.status === 'completed' || roomState.status === 'abandoned'
					? 'finished'
					: roomState.status === 'waiting'
						? 'waiting'
						: 'playing';

			const update: RoomStatusUpdate = {
				roomCode: roomState.roomCode,
				status: lobbyStatus,
				playerCount: players.length,
				spectatorCount: this.getSpectatorCount(),
				maxPlayers: roomState.settings.maxPlayers,
				roundNumber: 0, // TODO: Get from game state
				totalRounds: 13,
				isPublic: roomState.settings.isPublic,
				allowSpectators: roomState.settings.allowSpectators,
				players,
				hostId: roomState.hostUserId,
				hostName: hostState?.displayName ?? 'Unknown',
				game: 'dicee',
				updatedAt: Date.now(),
			};

			// Call GlobalLobby RPC
			this.lobbyStub.updateRoomStatus(update);
		} catch (error) {
			console.error('[GameRoom] Failed to notify lobby:', error);
		}
	}

	/**
	 * Send a highlight event to the lobby ticker.
	 */
	private sendLobbyHighlight(
		type: GameHighlight['type'],
		message: string,
		playerName?: string,
		score?: number,
	): void {
		try {
			const highlight: GameHighlight = {
				roomCode: this.getRoomCode(),
				type,
				message,
				playerName,
				score,
				timestamp: Date.now(),
			};
			this.lobbyStub.sendHighlight(highlight);
		} catch (error) {
			console.error('[GameRoom] Failed to send highlight:', error);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Connection Lifecycle
	// ─────────────────────────────────────────────────────────────────────────────

	private async onConnect(ws: WebSocket, connState: ConnectionState): Promise<void> {
		// Initialize chat manager (loads state from storage)
		await this.chatManager.initialize();

		// Load or initialize room state
		let roomState = await this.ctx.storage.get<RoomState>('room');

		if (connState.role === 'spectator') {
			// Spectator connection - room must already exist
			if (!roomState) {
				ws.close(4004, 'Room not found');
				return;
			}

			// Send initial state to spectator
			ws.send(
				JSON.stringify({
					type: 'SPECTATOR_CONNECTED',
					payload: {
						roomCode: roomState.roomCode,
						players: await this.getPlayerList(),
						spectators: this.getSpectatorList(),
						roomStatus: roomState.status,
						spectatorCount: this.getSpectatorCount(),
					},
				}),
			);

			// Send chat history to spectator
			this.sendChatHistory(ws);

			// Notify everyone about new spectator
			const spectatorMsg = await this.chatManager.createSystemMessage(
				`${connState.displayName} is now watching`,
			);
			this.broadcast(createChatMessageResponse(spectatorMsg));

			// Broadcast spectator join to everyone
			this.broadcast(
				{
					type: 'SPECTATOR_JOINED',
					payload: {
						userId: connState.userId,
						displayName: connState.displayName,
						avatarSeed: connState.avatarSeed,
						spectatorCount: this.getSpectatorCount(),
					},
				},
				ws,
			);

			// Notify GlobalLobby of spectator count change
			await this.notifyLobbyOfUpdate();
			return;
		}

		// Player connection
		if (!roomState) {
			// First connection creates the room
			roomState = createInitialRoomState(this.getRoomCode(), connState.userId);
			await this.ctx.storage.put('room', roomState);

			// Update connection state to mark as host
			connState.isHost = true;
			ws.serializeAttachment(connState);
		} else {
			// Check if rejoining or new player
			connState.isHost = connState.userId === roomState.hostUserId;
			ws.serializeAttachment(connState);

			// Add to player order if new
			if (!roomState.playerOrder.includes(connState.userId)) {
				roomState.playerOrder.push(connState.userId);
				await this.ctx.storage.put('room', roomState);
			}
		}

		// Send initial state to new connection
		ws.send(
			JSON.stringify({
				type: 'CONNECTED',
				payload: {
					roomCode: roomState.roomCode,
					isHost: connState.isHost,
					players: await this.getPlayerList(),
					aiPlayers: roomState.aiPlayers ?? [],
					spectators: this.getSpectatorList(),
					roomStatus: roomState.status,
					spectatorCount: this.getSpectatorCount(),
				},
			}),
		);

		// Send chat history to new connection
		this.sendChatHistory(ws);

		// Send current typing users
		const typingUsers = this.chatManager.getTypingUsers();
		if (typingUsers.length > 0) {
			ws.send(JSON.stringify(createTypingUpdateResponse(typingUsers)));
		}

		// Create system message for join (broadcast to all)
		const systemMsg = await this.chatManager.createSystemMessage(
			`${connState.displayName} joined the lobby`,
		);
		this.broadcast(createChatMessageResponse(systemMsg));

		// Notify others about player join
		this.broadcast(
			{
				type: 'PLAYER_JOINED',
				payload: {
					userId: connState.userId,
					displayName: connState.displayName,
					avatarSeed: connState.avatarSeed,
				},
			},
			ws,
		);

		// Notify GlobalLobby of player count change
		await this.notifyLobbyOfUpdate();
	}

	private async handleMessage(
		ws: WebSocket,
		connState: ConnectionState,
		message: { type: string; payload?: unknown },
	): Promise<void> {
		const { type, payload } = message;
		console.log(`[GameRoom] >>> RECEIVED: ${type} from ${connState.userId}`);

		// Route chat-related messages through ChatManager
		if (isChatMessageType(type)) {
			await this.handleChatMessage(ws, connState, message);
			return;
		}

		switch (type) {
			case 'START_GAME':
				await this.handleStartGame(ws, connState);
				break;

			case 'QUICK_PLAY_START':
				await this.handleQuickPlayStart(ws, connState, payload as { aiProfiles: string[] });
				break;

			case 'ADD_AI_PLAYER':
				await this.handleAddAIPlayer(ws, connState, payload as { profileId: string });
				break;

			// ─────────────────────────────────────────────────────────────────────────
			// Core Game Loop Commands (DO-4)
			// ─────────────────────────────────────────────────────────────────────────

			case 'DICE_ROLL':
				await this.handleDiceRoll(ws, connState, payload as { kept?: boolean[] });
				break;

			case 'DICE_KEEP':
				await this.handleDiceKeep(ws, connState, payload as { indices: number[] });
				break;

			case 'CATEGORY_SCORE':
				await this.handleCategoryScore(ws, connState, payload as { category: Category });
				break;

			case 'PREDICTION':
				await this.handlePrediction(ws, connState, payload as {
					playerId: string;
					type: PredictionType;
					exactScore?: number;
				});
				break;

			case 'CANCEL_PREDICTION':
				this.handleCancelPrediction(ws, connState, payload as { predictionId: string });
				break;

			case 'GET_PREDICTIONS':
				this.handleGetPredictions(ws);
				break;

			case 'GET_PREDICTION_STATS':
				this.handleGetPredictionStats(ws, connState);
				break;

			case 'ROOT_FOR_PLAYER':
				this.handleRootForPlayer(ws, connState, payload as { playerId: string });
				break;

			case 'CLEAR_ROOTING':
				this.handleClearRooting(ws, connState);
				break;

			case 'GET_ROOTING':
				this.handleGetRooting(ws);
				break;

			case 'KIBITZ':
				this.handleKibitz(ws, connState, payload as {
					playerId: string;
					voteType: KibitzVoteType;
					category?: string;
					keepPattern?: number;
					action?: 'roll' | 'score';
				});
				break;

			case 'CLEAR_KIBITZ':
				this.handleClearKibitz(ws, connState);
				break;

			case 'GET_KIBITZ':
				this.handleGetKibitz(ws);
				break;

			// ─────────────────────────────────────────────────────────────────────────
			// Spectator Reaction Messages (D7)
			// ─────────────────────────────────────────────────────────────────────────

			case 'SPECTATOR_REACTION':
				this.handleSpectatorReaction(ws, connState, payload as {
					emoji: SpectatorReactionEmoji;
					targetPlayerId?: string;
				});
				break;

			// ─────────────────────────────────────────────────────────────────────────
			// Join Queue Messages (D8)
			// ─────────────────────────────────────────────────────────────────────────

			case 'JOIN_QUEUE':
				this.handleJoinQueue(ws, connState);
				break;

			case 'LEAVE_QUEUE':
				this.handleLeaveQueue(ws, connState);
				break;

			case 'GET_QUEUE':
				this.handleGetQueue(ws);
				break;

			// ─────────────────────────────────────────────────────────────────────────
			// Gallery Points Messages (D9)
			// ─────────────────────────────────────────────────────────────────────────

			case 'GET_GALLERY_POINTS':
				this.handleGetGalleryPoints(ws, connState);
				break;

			case 'PING':
				ws.send(JSON.stringify({ type: 'PONG', payload: Date.now() }));
				break;

			case 'REMATCH':
				await this.handleRematch(ws, connState);
				break;

			default:
				this.sendError(ws, 'UNKNOWN_COMMAND', `Unknown message type: ${type}`);
		}
	}

	private async onDisconnect(connState: ConnectionState, code: number, _reason: string): Promise<void> {
		// Clear typing indicator for disconnected user
		const wasTyping = this.chatManager.clearTyping(connState.userId);
		if (wasTyping) {
			this.broadcastTypingUpdate();
		}

		const reason = code === 1000 ? 'left' : 'disconnected';

		if (connState.role === 'spectator') {
			// Spectator disconnect - no AFK check needed
			const systemMsg = await this.chatManager.createSystemMessage(
				`${connState.displayName} stopped watching`,
			);
			this.broadcast(createChatMessageResponse(systemMsg));

			// Remove from join queue if they were queued (D8)
			this.removeFromQueueOnDisconnect(connState.userId);

			// Notify about spectator leaving
			this.broadcast({
				type: 'SPECTATOR_LEFT',
				payload: {
					userId: connState.userId,
					displayName: connState.displayName,
					spectatorCount: this.getSpectatorCount(),
				},
			});

			// Notify GlobalLobby of spectator count change
			await this.notifyLobbyOfUpdate();
			return;
		}

		// Player disconnect
		const systemMsg = await this.chatManager.createSystemMessage(
			`${connState.displayName} ${reason === 'left' ? 'left the lobby' : 'disconnected'}`,
		);
		this.broadcast(createChatMessageResponse(systemMsg));

		// Notify other players
		this.broadcast({
			type: 'PLAYER_LEFT',
			payload: {
				userId: connState.userId,
				displayName: connState.displayName,
				reason,
			},
		});

		// Notify GlobalLobby of player count change
		await this.notifyLobbyOfUpdate();

		// Set AFK check alarm for players only
		const alarmData: AlarmData = { type: 'AFK_CHECK', userId: connState.userId };
		await this.ctx.storage.put('alarm_data', alarmData);
		await this.ctx.storage.setAlarm(Date.now() + 60_000); // 60 second reconnect window
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Game Logic Handlers (DO-4 Core Game Loop)
	// ─────────────────────────────────────────────────────────────────────────────

	private async handleStartGame(ws: WebSocket, connState: ConnectionState): Promise<void> {
		if (!connState.isHost) {
			this.sendError(ws, 'NOT_HOST', 'Only the host can start the game');
			return;
		}

		const roomCode = this.getRoomCode();
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			this.sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
			return;
		}

		// Gather connected human players
		const players: Array<{
			id: string;
			displayName: string;
			avatarSeed: string;
			isHost: boolean;
			connectionId: string;
			type?: 'human' | 'ai';
			aiProfileId?: string;
		}> = [];

		for (const playerWs of this.ctx.getWebSockets(`player:${roomCode}`)) {
			const state = playerWs.deserializeAttachment() as ConnectionState;
			players.push({
				id: state.userId,
				displayName: state.displayName,
				avatarSeed: state.avatarSeed,
				isHost: state.isHost,
				connectionId: state.userId, // Use userId as connectionId
				type: 'human',
			});
		}

		// Add AI players from room state
		if (roomState.aiPlayers && roomState.aiPlayers.length > 0) {
			for (const aiPlayer of roomState.aiPlayers) {
				players.push({
					id: aiPlayer.id,
					displayName: aiPlayer.displayName,
					avatarSeed: aiPlayer.avatarSeed,
					isHost: false,
					connectionId: aiPlayer.id, // AI uses its own ID as connectionId
					type: 'ai',
					aiProfileId: aiPlayer.profileId,
				});
			}
		}

		if (players.length < 2) {
			this.sendError(ws, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players');
			return;
		}

		// Initialize game state
		const config: MultiplayerGameState['config'] = {
			maxPlayers: roomState.settings.maxPlayers,
			turnTimeoutSeconds: roomState.settings.turnTimeoutSeconds,
			isPublic: roomState.settings.isPublic,
		};

		await this.gameStateManager.initializeFromRoom(players, config);

		// Initialize AI manager and register AI players
		await this.aiManager.initialize();
		for (const player of players) {
			if (player.type === 'ai' && player.aiProfileId) {
				await this.aiManager.addAIPlayer(player.id, player.aiProfileId);
			}
		}

		// Update room status
		roomState.status = 'starting';
		roomState.startedAt = Date.now();
		await this.ctx.storage.put('room', roomState);

		// Broadcast starting
		this.broadcast({ type: 'GAME_STARTING', payload: { playerCount: players.length } });

		// Start the game immediately (could add countdown later)
		const startResult = await this.gameStateManager.startGame();

		// Update room status to playing
		roomState.status = 'playing';
		await this.ctx.storage.put('room', roomState);

		// Get full game state for broadcast
		const gameState = await this.gameStateManager.getState();

		// Broadcast game started
		this.broadcast({
			type: 'GAME_STARTED',
			payload: {
				playerOrder: startResult.playerOrder,
				currentPlayerId: startResult.currentPlayerId,
				turnNumber: startResult.turnNumber,
				roundNumber: 1,
				phase: gameState?.phase ?? 'turn_roll',
				players: gameState?.players ?? {},
			},
		});

		// Schedule turn timeout if configured (only for human players)
		if (roomState.settings.turnTimeoutSeconds > 0 && !this.aiManager.isAIPlayer(startResult.currentPlayerId)) {
			await this.gameStateManager.scheduleAfkWarning(startResult.currentPlayerId);
		}

		// Notify lobby
		await this.notifyLobbyOfUpdate();

		// Note: No lobby highlight for game start (only for notable game events)

		// Trigger AI turn if first player is AI
		console.log(`[GameRoom] About to trigger AI turn check for: ${startResult.currentPlayerId}`);
		await this.triggerAITurnIfNeeded(startResult.currentPlayerId);
		console.log(`[GameRoom] AI turn trigger complete`);
	}

	/**
	 * Handle rematch request from host after game over.
	 * Resets game state and starts a new game with the same players.
	 */
	private async handleRematch(ws: WebSocket, connState: ConnectionState): Promise<void> {
		// Validate using game machine
		const gameState = await this.gameStateManager.getState();
		if (!gameState) {
			this.sendError(ws, 'NO_GAME', 'No game in progress');
			return;
		}

		const validation = canRematch(gameState, connState.userId);
		if (!validation.success) {
			this.sendError(ws, validation.error ?? 'REMATCH_ERROR', validation.message ?? 'Cannot rematch');
			return;
		}

		// Reset game state for rematch
		await this.gameStateManager.resetForRematch();

		// Update room state back to waiting
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (roomState) {
			roomState.status = 'waiting';
			roomState.startedAt = null;
			await this.ctx.storage.put('room', roomState);
		}

		// Broadcast rematch started - clients should show waiting room
		this.broadcast({
			type: 'REMATCH_STARTED',
			payload: {
				roomCode: this.getRoomCode(),
				players: await this.getPlayerList(),
			},
		});

		// Notify lobby
		await this.notifyLobbyOfUpdate();
	}

	/**
	 * Handle Quick Play start - creates room directly in playing state with human first.
	 * This skips the waiting room entirely for solo vs AI games.
	 */
	private async handleQuickPlayStart(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { aiProfiles: string[] },
	): Promise<void> {
		// Only host can start quick play
		if (!connState.isHost) {
			this.sendError(ws, 'NOT_HOST', 'Only the host can start quick play');
			return;
		}

		const roomCode = this.getRoomCode();
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			this.sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
			return;
		}

		// Must be in waiting phase
		if (roomState.status !== 'waiting') {
			this.sendError(ws, 'GAME_IN_PROGRESS', 'Game already in progress');
			return;
		}

		// Validate AI profiles and create AI players
		const aiProfiles = payload.aiProfiles || [];
		if (aiProfiles.length === 0) {
			this.sendError(ws, 'NO_AI_PROFILES', 'Quick play requires at least one AI opponent');
			return;
		}

		// Create AI players
		const aiPlayers: Array<{
			id: string;
			profileId: string;
			displayName: string;
			avatarSeed: string;
		}> = [];

		for (const profileId of aiProfiles) {
			const profile = getProfile(profileId);
			if (!profile) {
				this.sendError(ws, 'INVALID_PROFILE', `Unknown AI profile: ${profileId}`);
				return;
			}

			const aiPlayerId = `ai:${profileId}:${Date.now()}`;
			const aiPlayer = createAIPlayerState(aiPlayerId, profileId);
			aiPlayers.push({
				id: aiPlayerId,
				profileId,
				displayName: aiPlayer.displayName ?? profile.name,
				avatarSeed: aiPlayer.avatarSeed ?? profile.avatarSeed,
			});
		}

		// Store AI players in room state
		roomState.aiPlayers = aiPlayers;
		await this.ctx.storage.put('room', roomState);

		// Build player list: Human first (always), then AI players
		const players: Array<{
			id: string;
			displayName: string;
			avatarSeed: string;
			isHost: boolean;
			connectionId: string;
			type: 'human' | 'ai';
			aiProfileId?: string;
		}> = [];

		// Add human player first (guaranteed first turn)
		players.push({
			id: connState.userId,
			displayName: connState.displayName,
			avatarSeed: connState.avatarSeed,
			isHost: true,
			connectionId: connState.userId,
			type: 'human',
		});

		// Add AI players
		for (const aiPlayer of aiPlayers) {
			players.push({
				id: aiPlayer.id,
				displayName: aiPlayer.displayName,
				avatarSeed: aiPlayer.avatarSeed,
				isHost: false,
				connectionId: aiPlayer.id,
				type: 'ai',
				aiProfileId: aiPlayer.profileId,
			});
		}

		// Initialize game state with human first in turn order
		const config: MultiplayerGameState['config'] = {
			maxPlayers: roomState.settings.maxPlayers,
			turnTimeoutSeconds: roomState.settings.turnTimeoutSeconds,
			isPublic: roomState.settings.isPublic,
		};

		await this.gameStateManager.initializeFromRoom(players, config);

		// Initialize AI manager and register AI players
		await this.aiManager.initialize();
		for (const player of players) {
			if (player.type === 'ai' && player.aiProfileId) {
				await this.aiManager.addAIPlayer(player.id, player.aiProfileId);
			}
		}

		// Start game with human as first player (no randomization for quick play)
		const startResult = await this.gameStateManager.startGameWithOrder(
			players.map((p) => p.id), // Human first, then AI
		);

		// Update room status directly to playing (skip 'starting' phase)
		roomState.status = 'playing';
		roomState.startedAt = Date.now();
		await this.ctx.storage.put('room', roomState);

		// Get full game state for broadcast
		const gameState = await this.gameStateManager.getState();

		// Broadcast game started (skip GAME_STARTING for quick play)
		// Send full player state (same format as GAME_STARTED)
		this.broadcast({
			type: 'QUICK_PLAY_STARTED',
			payload: {
				playerOrder: startResult.playerOrder,
				currentPlayerId: startResult.currentPlayerId,
				turnNumber: startResult.turnNumber,
				roundNumber: 1,
				phase: gameState?.phase ?? 'turn_roll',
				players: gameState?.players ?? {},
				config: gameState?.config,
			},
		});

		// Notify lobby
		await this.notifyLobbyOfUpdate();

		console.log(`[GameRoom] Quick Play started: human=${connState.userId}, AI=${aiPlayers.map((p) => p.id).join(', ')}`);

		// Human always goes first in quick play, so no AI turn trigger needed here
		// AI will play after human scores
	}

	/**
	 * Handle add AI player command (host only, during waiting)
	 */
	private async handleAddAIPlayer(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { profileId: string },
	): Promise<void> {
		// Only host can add AI players
		if (!connState.isHost) {
			this.sendError(ws, 'NOT_HOST', 'Only the host can add AI players');
			return;
		}

		const roomCode = this.getRoomCode();
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			this.sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
			return;
		}

		// Can only add AI during waiting phase
		if (roomState.status !== 'waiting') {
			this.sendError(ws, 'GAME_IN_PROGRESS', 'Cannot add AI players after game has started');
			return;
		}

		// Check if room is full
		const currentPlayerCount = this.ctx.getWebSockets(`player:${roomCode}`).length + (roomState.aiPlayers?.length ?? 0);
		if (currentPlayerCount >= roomState.settings.maxPlayers) {
			this.sendError(ws, 'ROOM_FULL', 'Room is full');
			return;
		}

		// Validate AI profile
		const profile = getProfile(payload.profileId);
		if (!profile) {
			this.sendError(ws, 'INVALID_PROFILE', `Unknown AI profile: ${payload.profileId}`);
			return;
		}

		// Create AI player ID
		const aiPlayerId = `ai:${payload.profileId}:${Date.now()}`;

		// Create AI player state
		const aiPlayer = createAIPlayerState(aiPlayerId, payload.profileId);

		// Store AI player in room state
		if (!roomState.aiPlayers) {
			roomState.aiPlayers = [];
		}
		roomState.aiPlayers.push({
			id: aiPlayerId,
			profileId: payload.profileId,
			displayName: aiPlayer.displayName ?? profile.name,
			avatarSeed: aiPlayer.avatarSeed ?? profile.avatarSeed,
		});
		await this.ctx.storage.put('room', roomState);

		// Broadcast AI player joined
		this.broadcast({
			type: 'AI_PLAYER_JOINED',
			payload: {
				playerId: aiPlayerId,
				profileId: payload.profileId,
				displayName: aiPlayer.displayName ?? profile.name,
				avatarSeed: aiPlayer.avatarSeed ?? profile.avatarSeed,
				isAI: true,
			},
		});

		// Notify lobby
		await this.notifyLobbyOfUpdate();
	}

	/**
	 * Handle dice roll command
	 */
	private async handleDiceRoll(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { kept?: boolean[] },
	): Promise<void> {
		const gameState = await this.gameStateManager.getState();
		if (!gameState) {
			this.sendError(ws, 'NO_GAME', 'No game in progress');
			return;
		}

		// Validate the roll
		const validation = canRollDice(gameState, connState.userId);
		if (!validation.success) {
			this.sendError(ws, validation.error, validation.message);
			return;
		}

		// Parse kept mask (default: keep nothing)
		const keptMask: KeptMask = [false, false, false, false, false];
		if (payload.kept && Array.isArray(payload.kept)) {
			for (let i = 0; i < 5 && i < payload.kept.length; i++) {
				keptMask[i] = Boolean(payload.kept[i]);
			}
		}

		// Execute the roll
		const result = await this.gameStateManager.rollDice(connState.userId, keptMask);

		// Broadcast dice rolled to all players
		this.broadcast({
			type: 'DICE_ROLLED',
			payload: {
				playerId: connState.userId,
				dice: result.dice,
				rollNumber: result.rollNumber,
				rollsRemaining: result.rollsRemaining,
				phase: result.newPhase,
			},
		});

		// Also send to spectators
		this.broadcastToSpectators({
			type: 'DICE_ROLLED',
			payload: {
				playerId: connState.userId,
				dice: result.dice,
				rollNumber: result.rollNumber,
				rollsRemaining: result.rollsRemaining,
				phase: result.newPhase,
			},
		});

		// Update turn tracking for predictions
		this.currentTurn = {
			turnNumber: gameState.turnNumber,
			playerId: connState.userId,
		};

		// Reset kibitz votes on new roll
		this.kibitzVotes.clear();
	}

	/**
	 * Handle keep dice command
	 */
	private async handleDiceKeep(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { indices: number[] },
	): Promise<void> {
		const gameState = await this.gameStateManager.getState();
		if (!gameState) {
			this.sendError(ws, 'NO_GAME', 'No game in progress');
			return;
		}

		// Validate the keep
		const validation = canKeepDice(gameState, connState.userId);
		if (!validation.success) {
			this.sendError(ws, validation.error, validation.message);
			return;
		}

		// Validate indices
		const indices = payload.indices ?? [];
		if (!Array.isArray(indices) || indices.some((i) => typeof i !== 'number' || i < 0 || i > 4)) {
			this.sendError(ws, 'INVALID_INDICES', 'Invalid dice indices');
			return;
		}

		// Execute keep
		const newKept = await this.gameStateManager.keepDice(connState.userId, indices);

		// Broadcast dice kept
		this.broadcast({
			type: 'DICE_KEPT',
			payload: {
				playerId: connState.userId,
				kept: newKept,
			},
		});

		// Also send to spectators
		this.broadcastToSpectators({
			type: 'DICE_KEPT',
			payload: {
				playerId: connState.userId,
				kept: newKept,
			},
		});
	}

	/**
	 * Handle category score command
	 */
	private async handleCategoryScore(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { category: Category },
	): Promise<void> {
		const gameState = await this.gameStateManager.getState();
		if (!gameState) {
			this.sendError(ws, 'NO_GAME', 'No game in progress');
			return;
		}

		const category = payload.category;
		if (!category) {
			this.sendError(ws, 'INVALID_CATEGORY', 'Category is required');
			return;
		}

		// Validate the score
		const validation = canScoreCategory(gameState, connState.userId, category);
		if (!validation.success) {
			this.sendError(ws, validation.error, validation.message);
			return;
		}

		// Execute scoring
		const result = await this.gameStateManager.scoreCategory(connState.userId, category);

		// Evaluate predictions for this turn
		// wasDicee: scored a dicee (50) or got bonus
		// improved: scored > 0 (simplified - could track position changes)
		// bricked: scored 0
		this.evaluatePredictions({
			playerId: connState.userId,
			wasDicee: result.isDiceeBonus || (category === 'dicee' && result.score === 50),
			improved: result.score > 0,
			bricked: result.score === 0,
			finalScore: result.score,
		});

		// Broadcast category scored
		this.broadcast({
			type: 'CATEGORY_SCORED',
			payload: {
				playerId: connState.userId,
				category,
				score: result.score,
				totalScore: result.totalScore,
				isDiceeBonus: result.isDiceeBonus,
			},
		});

		// Also send to spectators
		this.broadcastToSpectators({
			type: 'CATEGORY_SCORED',
			payload: {
				playerId: connState.userId,
				category,
				score: result.score,
				totalScore: result.totalScore,
				isDiceeBonus: result.isDiceeBonus,
			},
		});

		// Check for Dicee highlight
		if (result.isDiceeBonus || (category === 'dicee' && result.score === 50)) {
			const player = gameState.players[connState.userId];
			this.sendLobbyHighlight('dicee', `${player?.displayName ?? 'Player'} rolled a Dicee!`, player?.displayName, result.score);
		}

		// Handle game completion or turn advancement
		if (result.gameCompleted) {
			// Game over
			this.handleGameOver(result.rankings);
		} else if (result.nextPlayerId) {
			// Next player's turn
			this.broadcast({
				type: 'TURN_CHANGED',
				payload: {
					currentPlayerId: result.nextPlayerId,
					turnNumber: result.nextTurnNumber,
					roundNumber: result.nextRoundNumber,
					phase: result.nextPhase,
				},
			});

			// Also send to spectators
			this.broadcastToSpectators({
				type: 'TURN_CHANGED',
				payload: {
					currentPlayerId: result.nextPlayerId,
					turnNumber: result.nextTurnNumber,
					roundNumber: result.nextRoundNumber,
					phase: result.nextPhase,
				},
			});

			// Update turn tracking
			this.currentTurn = {
				turnNumber: result.nextTurnNumber,
				playerId: result.nextPlayerId,
			};

			// Clear kibitz votes for new turn
			this.kibitzVotes.clear();

			// Schedule turn timeout for next player (only for human players)
			const roomState = await this.ctx.storage.get<RoomState>('room');
			if (roomState?.settings.turnTimeoutSeconds && roomState.settings.turnTimeoutSeconds > 0) {
				if (!this.aiManager.isAIPlayer(result.nextPlayerId)) {
					await this.gameStateManager.scheduleAfkWarning(result.nextPlayerId);
				}
			}

			// Trigger AI turn if next player is AI
			await this.triggerAITurnIfNeeded(result.nextPlayerId);
		}

		// Notify lobby of update
		await this.notifyLobbyOfUpdate();
	}

	/**
	 * Handle game over - broadcast rankings and send highlights
	 */
	private handleGameOver(rankings: Array<{ playerId: string; displayName: string; rank: number; score: number; diceeCount: number }> | null): void {
		if (!rankings) return;

		// Broadcast game over
		this.broadcast({
			type: 'GAME_OVER',
			payload: {
				rankings,
				winnerId: rankings[0]?.playerId,
				winnerName: rankings[0]?.displayName,
				winnerScore: rankings[0]?.score,
			},
		});

		// Also send to spectators
		this.broadcastToSpectators({
			type: 'GAME_OVER',
			payload: {
				rankings,
				winnerId: rankings[0]?.playerId,
				winnerName: rankings[0]?.displayName,
				winnerScore: rankings[0]?.score,
			},
		});

		// Send lobby highlights
		const winner = rankings[0];
		if (winner) {
			this.sendLobbyHighlight('game_complete', `${winner.displayName} wins with ${winner.score} points!`, winner.displayName, winner.score);

			// Check for close finish
			if (rankings.length >= 2 && rankings[0].score - rankings[1].score <= 10) {
				this.sendLobbyHighlight('close_finish', `Close game! ${rankings[0].displayName} beat ${rankings[1].displayName} by ${rankings[0].score - rankings[1].score} points!`);
			}

			// High score highlight (300+ is notable)
			if (winner.score >= 300) {
				this.sendLobbyHighlight('high_score', `${winner.displayName} scored ${winner.score}!`, winner.displayName, winner.score);
			}
		}

		// Evaluate spectator backings
		this.evaluateSpectatorBackings(rankings);

		// Update room status
		this.ctx.storage.get<RoomState>('room').then((roomState) => {
			if (roomState) {
				roomState.status = 'completed';
				this.ctx.storage.put('room', roomState);
			}
		});

		// Notify lobby
		this.notifyLobbyOfUpdate();
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// AI Turn Execution
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Execute an AI command on behalf of an AI player.
	 * This is called by AIRoomManager during AI turn execution.
	 */
	private async executeAICommand(playerId: string, command: AICommand): Promise<void> {
		console.log(`[GameRoom] executeAICommand ENTRY: ${playerId} ${command.type}`);

		const gameState = await this.gameStateManager.getState();
		if (!gameState) {
			console.error('[GameRoom] No game state for AI command');
			return;
		}

		console.log(`[GameRoom] executeAICommand has game state, processing ${command.type}`);


		switch (command.type) {
			case 'roll': {
				// Execute the roll
				const keptMask = gameState.players[playerId]?.keptDice ?? [false, false, false, false, false];
				const result = await this.gameStateManager.rollDice(playerId, keptMask);

				// Broadcast dice rolled
				this.broadcast({
					type: 'DICE_ROLLED',
					payload: {
						playerId,
						dice: result.dice,
						rollNumber: result.rollNumber,
						rollsRemaining: result.rollsRemaining,
						phase: result.newPhase,
					},
				});

				this.broadcastToSpectators({
					type: 'DICE_ROLLED',
					payload: {
						playerId,
						dice: result.dice,
						rollNumber: result.rollNumber,
						rollsRemaining: result.rollsRemaining,
						phase: result.newPhase,
					},
				});
				break;
			}

			case 'keep': {
				// Convert keepMask to indices
				const indices: number[] = [];
				for (let i = 0; i < 5; i++) {
					if (command.keepMask[i]) {
						indices.push(i);
					}
				}

				// Execute keep
				const newKept = await this.gameStateManager.keepDice(playerId, indices);

				// Broadcast dice kept
				this.broadcast({
					type: 'DICE_KEPT',
					payload: {
						playerId,
						kept: newKept,
					},
				});

				this.broadcastToSpectators({
					type: 'DICE_KEPT',
					payload: {
						playerId,
						kept: newKept,
					},
				});
				break;
			}

			case 'score': {
				// Execute scoring
				const result = await this.gameStateManager.scoreCategory(playerId, command.category);

				// Broadcast category scored
				this.broadcast({
					type: 'CATEGORY_SCORED',
					payload: {
						playerId,
						category: command.category,
						score: result.score,
						totalScore: result.totalScore,
						isDiceeBonus: result.isDiceeBonus,
					},
				});

				this.broadcastToSpectators({
					type: 'CATEGORY_SCORED',
					payload: {
						playerId,
						category: command.category,
						score: result.score,
						totalScore: result.totalScore,
						isDiceeBonus: result.isDiceeBonus,
					},
				});

				// Check for Dicee highlight
				if (result.isDiceeBonus || (command.category === 'dicee' && result.score === 50)) {
					const player = gameState.players[playerId];
					this.sendLobbyHighlight('dicee', `${player?.displayName ?? 'AI'} rolled a Dicee!`, player?.displayName, result.score);
				}

				// Handle game completion or turn advancement
				if (result.gameCompleted) {
					this.handleGameOver(result.rankings);
				} else if (result.nextPlayerId) {
					// Broadcast turn change
					this.broadcast({
						type: 'TURN_CHANGED',
						payload: {
							currentPlayerId: result.nextPlayerId,
							turnNumber: result.nextTurnNumber,
							roundNumber: result.nextRoundNumber,
							phase: result.nextPhase,
						},
					});

					this.broadcastToSpectators({
						type: 'TURN_CHANGED',
						payload: {
							currentPlayerId: result.nextPlayerId,
							turnNumber: result.nextTurnNumber,
							roundNumber: result.nextRoundNumber,
							phase: result.nextPhase,
						},
					});

					// Schedule turn timeout for next player (if human)
					const roomState = await this.ctx.storage.get<RoomState>('room');
					if (roomState?.settings.turnTimeoutSeconds && roomState.settings.turnTimeoutSeconds > 0) {
						// Only schedule timeout for human players
						if (!this.aiManager.isAIPlayer(result.nextPlayerId)) {
							await this.gameStateManager.scheduleAfkWarning(result.nextPlayerId);
						}
					}

					// Trigger AI turn if next player is AI
					await this.triggerAITurnIfNeeded(result.nextPlayerId);
				}

				// Notify lobby
				await this.notifyLobbyOfUpdate();
				break;
			}
		}
	}

	/**
	 * Trigger AI turn execution if the given player is an AI.
	 */
	private async triggerAITurnIfNeeded(playerId: string): Promise<void> {
		if (!this.aiManager.isAIPlayer(playerId)) {
			return;
		}

		console.log(`[GameRoom] triggerAITurnIfNeeded: ${playerId}`);

		// Execute AI turn in background (don't await to avoid blocking)
		this.ctx.waitUntil(
			this.aiManager.executeAITurn(
				playerId,
				// Pass a getter function so AI gets fresh state each step
				async () => this.gameStateManager.getState(),
				async (pid, cmd) => {
					console.log(`[GameRoom] execute callback invoked: ${pid} ${cmd.type}`);
					try {
						await this.executeAICommand(pid, cmd);
						console.log(`[GameRoom] execute callback complete: ${cmd.type}`);
					} catch (e) {
						console.error(`[GameRoom] execute callback FAILED: ${cmd.type}`, e);
						throw e;
					}
				},
				(event) => {
					// Broadcast AI events to all clients
					this.broadcast(event);
					this.broadcastToSpectators(event);
				},
			).catch((error) => {
				console.error('[GameRoom] AI turn execution failed:', error);
			}),
		);
	}

	/**
	 * Evaluate spectator backings after game ends
	 */
	private evaluateSpectatorBackings(rankings: Array<{ playerId: string; displayName: string; rank: number; score: number }> | null): void {
		if (!rankings || rankings.length === 0) return;

		const winnerId = rankings[0].playerId;

		for (const [spectatorId, rooting] of this.rootingChoices) {
			const points = this.gameGalleryPoints.get(spectatorId) ?? createEmptyGalleryPoints();

			if (rooting.playerId === winnerId) {
				// Backed the winner
				points.backing.backedWinner = GALLERY_POINT_VALUES.BACKED_WINNER;

				// Check for underdog bonus (winner had lowest score going into final round)
				// For now, just award base points - more complex logic would require tracking mid-game scores
			}

			this.gameGalleryPoints.set(spectatorId, points);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Chat System Handlers
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle all chat-related messages through ChatManager
	 */
	private async handleChatMessage(
		ws: WebSocket,
		connState: ConnectionState,
		message: { type: string; payload?: unknown },
	): Promise<void> {
		// Validate message schema
		const validation = validateChatMessage(message);
		if (!validation.success) {
			ws.send(JSON.stringify(createChatErrorResponse('INVALID_MESSAGE', validation.error.message)));
			return;
		}

		const validated = validation.data;

		switch (validated.type) {
			case 'CHAT':
				await this.handleTextChat(ws, connState, validated.payload.content);
				break;

			case 'QUICK_CHAT':
				await this.handleQuickChat(ws, connState, validated.payload.key as QuickChatKey);
				break;

			case 'REACTION':
				await this.handleReaction(
					ws,
					connState,
					validated.payload.messageId,
					validated.payload.emoji as ReactionEmoji,
					validated.payload.action,
				);
				break;

			case 'TYPING_START':
				this.handleTypingStart(connState);
				break;

			case 'TYPING_STOP':
				this.handleTypingStop(connState);
				break;
		}
	}

	/**
	 * Handle text chat message
	 */
	private async handleTextChat(ws: WebSocket, connState: ConnectionState, content: string): Promise<void> {
		const result = await this.chatManager.handleTextMessage(
			connState.userId,
			connState.displayName,
			content,
		);

		if (!result.success) {
			ws.send(JSON.stringify(createChatErrorResponse(result.error, result.errorMessage)));
			return;
		}

		// Broadcast the message to all connected clients
		this.broadcast(createChatMessageResponse(result.message));

		// Broadcast updated typing status (user stopped typing)
		this.broadcastTypingUpdate();
	}

	/**
	 * Handle quick chat message
	 */
	private async handleQuickChat(ws: WebSocket, connState: ConnectionState, key: QuickChatKey): Promise<void> {
		const result = await this.chatManager.handleQuickChat(
			connState.userId,
			connState.displayName,
			key,
		);

		if (!result.success) {
			ws.send(JSON.stringify(createChatErrorResponse(result.error, result.errorMessage)));
			return;
		}

		// Broadcast the quick chat message
		this.broadcast(createChatMessageResponse(result.message));
	}

	/**
	 * Handle reaction add/remove
	 */
	private async handleReaction(
		ws: WebSocket,
		connState: ConnectionState,
		messageId: string,
		emoji: ReactionEmoji,
		action: 'add' | 'remove',
	): Promise<void> {
		const result = await this.chatManager.handleReaction(
			connState.userId,
			messageId,
			emoji,
			action,
		);

		if (!result.success) {
			ws.send(JSON.stringify(createChatErrorResponse(result.error, result.errorMessage)));
			return;
		}

		// Broadcast the reaction update
		this.broadcast(createReactionUpdateResponse(result.messageId, result.reactions));
	}

	/**
	 * Handle typing start indicator
	 */
	private handleTypingStart(connState: ConnectionState): void {
		const shouldBroadcast = this.chatManager.handleTypingStart(
			connState.userId,
			connState.displayName,
		);

		if (shouldBroadcast) {
			this.broadcastTypingUpdate();
		}
	}

	/**
	 * Handle typing stop indicator
	 */
	private handleTypingStop(connState: ConnectionState): void {
		const shouldBroadcast = this.chatManager.handleTypingStop(connState.userId);

		if (shouldBroadcast) {
			this.broadcastTypingUpdate();
		}
	}

	/**
	 * Broadcast current typing users to all clients
	 */
	private broadcastTypingUpdate(): void {
		const typingUsers = this.chatManager.getTypingUsers();
		this.broadcast(createTypingUpdateResponse(typingUsers));
	}

	/**
	 * Send chat history to a newly connected user
	 */
	private sendChatHistory(ws: WebSocket): void {
		const history = this.chatManager.getHistory();
		ws.send(JSON.stringify(createChatHistoryResponse(history)));
	}

	private async getPlayerList(): Promise<PlayerInfo[]> {
		const roomState = await this.ctx.storage.get<RoomState>('room');
		const players: PlayerInfo[] = [];
		const roomCode = this.getRoomCode();

		// Only get players, not spectators
		for (const ws of this.ctx.getWebSockets(`player:${roomCode}`)) {
			const state = ws.deserializeAttachment() as ConnectionState;
			players.push({
				userId: state.userId,
				displayName: state.displayName,
				avatarSeed: state.avatarSeed,
				isHost: state.userId === roomState?.hostUserId,
				isConnected: true,
			});
		}

		return players;
	}

	/**
	 * Get list of connected spectators.
	 */
	private getSpectatorList(): SpectatorInfo[] {
		const spectators: SpectatorInfo[] = [];
		const roomCode = this.getRoomCode();

		for (const ws of this.ctx.getWebSockets(`spectator:${roomCode}`)) {
			const state = ws.deserializeAttachment() as ConnectionState;
			spectators.push({
				userId: state.userId,
				displayName: state.displayName,
				avatarSeed: state.avatarSeed,
				watchingSince: state.connectedAt,
			});
		}

		return spectators;
	}

	/**
	 * Get count of connected spectators.
	 */
	private getSpectatorCount(): number {
		const roomCode = this.getRoomCode();
		return this.ctx.getWebSockets(`spectator:${roomCode}`).length;
	}

	private async handleRoomInfo(): Promise<Response> {
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			return new Response('Room not found', { status: 404 });
		}

		return Response.json({
			roomCode: roomState.roomCode,
			playerCount: this.getConnectedUserIds().length,
			spectatorCount: this.getSpectatorCount(),
			maxPlayers: roomState.settings.maxPlayers,
			allowSpectators: roomState.settings.allowSpectators,
			status: roomState.status,
			createdAt: roomState.createdAt,
		});
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Gallery Predictions (D4)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle a prediction from a spectator
	 */
	private async handlePrediction(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { playerId: string; type: PredictionType; exactScore?: number },
	): Promise<void> {
		// Only spectators can make predictions
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can make predictions');
			return;
		}

		// Check if game is in progress
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState || roomState.status !== 'playing') {
			this.sendError(ws, 'GAME_NOT_PLAYING', 'Game must be in progress to make predictions');
			return;
		}

		// Validate player exists
		const playerIds = this.getConnectedUserIds();
		if (!playerIds.includes(payload.playerId)) {
			this.sendError(ws, 'INVALID_PLAYER', 'Invalid player ID');
			return;
		}

		// Validate exact score if provided
		if (payload.type === 'exact' && (payload.exactScore === undefined || payload.exactScore < 0 || payload.exactScore > 50)) {
			this.sendError(ws, 'INVALID_EXACT_SCORE', 'Exact score must be between 0 and 50');
			return;
		}

		// Get current turn key
		const turnKey = this.currentTurn
			? `${this.currentTurn.turnNumber}:${this.currentTurn.playerId}`
			: `0:${payload.playerId}`;

		// Get existing predictions for this turn
		const turnPredictions = this.predictions.get(turnKey) ?? [];

		// Check prediction limit per spectator
		const spectatorPredictions = turnPredictions.filter(p => p.spectatorId === connState.userId);
		if (spectatorPredictions.length >= GameRoom.MAX_PREDICTIONS_PER_TURN) {
			this.sendError(ws, 'PREDICTION_LIMIT', `Maximum ${GameRoom.MAX_PREDICTIONS_PER_TURN} predictions per turn`);
			return;
		}

		// Check for duplicate prediction type
		if (spectatorPredictions.some(p => p.type === payload.type)) {
			this.sendError(ws, 'DUPLICATE_PREDICTION', `Already made a ${payload.type} prediction this turn`);
			return;
		}

		// Create prediction
		const prediction: Prediction = {
			id: crypto.randomUUID(),
			spectatorId: connState.userId,
			spectatorName: connState.displayName,
			playerId: payload.playerId,
			type: payload.type,
			exactScore: payload.type === 'exact' ? payload.exactScore : undefined,
			timestamp: Date.now(),
			evaluated: false,
			correct: null,
			pointsAwarded: 0,
		};

		// Store prediction
		turnPredictions.push(prediction);
		this.predictions.set(turnKey, turnPredictions);

		// Send confirmation to spectator
		ws.send(JSON.stringify({
			type: 'PREDICTION_CONFIRMED',
			payload: prediction,
		}));

		// Broadcast to all spectators that a prediction was made (without revealing details)
		this.broadcastToSpectators({
			type: 'PREDICTION_MADE',
			payload: {
				spectatorName: connState.displayName,
				playerId: payload.playerId,
				predictionType: payload.type,
				totalPredictions: turnPredictions.length,
			},
		});

		console.log(`[GameRoom] Prediction made by ${connState.displayName}: ${payload.type} for player ${payload.playerId}`);
	}

	/**
	 * Handle cancellation of a prediction
	 */
	private handleCancelPrediction(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { predictionId: string },
	): void {
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can cancel predictions');
			return;
		}

		// Find and remove the prediction
		for (const [key, predictions] of this.predictions) {
			const index = predictions.findIndex(
				p => p.id === payload.predictionId && p.spectatorId === connState.userId && !p.evaluated
			);
			if (index !== -1) {
				predictions.splice(index, 1);
				this.predictions.set(key, predictions);

				ws.send(JSON.stringify({
					type: 'PREDICTION_CANCELLED',
					payload: { predictionId: payload.predictionId },
				}));
				return;
			}
		}

		this.sendError(ws, 'PREDICTION_NOT_FOUND', 'Prediction not found or already evaluated');
	}

	/**
	 * Get current predictions for the turn (spectator's own)
	 */
	private handleGetPredictions(ws: WebSocket): void {
		const connState = ws.deserializeAttachment() as ConnectionState;
		const turnKey = this.currentTurn
			? `${this.currentTurn.turnNumber}:${this.currentTurn.playerId}`
			: null;

		if (!turnKey) {
			ws.send(JSON.stringify({
				type: 'PREDICTIONS',
				payload: { predictions: [], turnActive: false },
			}));
			return;
		}

		const turnPredictions = this.predictions.get(turnKey) ?? [];
		const myPredictions = connState.role === 'spectator'
			? turnPredictions.filter(p => p.spectatorId === connState.userId)
			: [];

		ws.send(JSON.stringify({
			type: 'PREDICTIONS',
			payload: {
				predictions: myPredictions,
				turnActive: true,
				currentPlayer: this.currentTurn?.playerId,
				turnNumber: this.currentTurn?.turnNumber,
			},
		}));
	}

	/**
	 * Get spectator's prediction stats
	 */
	private handleGetPredictionStats(ws: WebSocket, connState: ConnectionState): void {
		if (connState.role !== 'spectator') {
			ws.send(JSON.stringify({
				type: 'PREDICTION_STATS',
				payload: null,
			}));
			return;
		}

		const stats = this.spectatorStats.get(connState.userId) ?? this.createInitialStats(connState.userId);

		ws.send(JSON.stringify({
			type: 'PREDICTION_STATS',
			payload: stats,
		}));
	}

	/**
	 * Create initial stats for a spectator
	 */
	private createInitialStats(spectatorId: string): SpectatorPredictionStats {
		return {
			spectatorId,
			totalPredictions: 0,
			correctPredictions: 0,
			accuracy: 0,
			totalPoints: 0,
			streak: 0,
			bestStreak: 0,
		};
	}

	/**
	 * Set the current turn for prediction purposes
	 * Called when a player's turn starts
	 */
	public setCurrentTurn(turnNumber: number, playerId: string): void {
		this.currentTurn = { turnNumber, playerId };

		// Broadcast to spectators that a new turn started
		this.broadcastToSpectators({
			type: 'TURN_STARTED',
			payload: {
				turnNumber,
				playerId,
				predictionsOpen: true,
			},
		});
	}

	/**
	 * Evaluate predictions at end of turn
	 * Called when a player scores (ends their turn)
	 */
	public evaluatePredictions(outcome: {
		playerId: string;
		wasDicee: boolean;
		improved: boolean;
		bricked: boolean;
		finalScore: number;
	}): PredictionResult[] {
		if (!this.currentTurn) return [];

		const turnKey = `${this.currentTurn.turnNumber}:${this.currentTurn.playerId}`;
		const turnPredictions = this.predictions.get(turnKey) ?? [];
		const results: PredictionResult[] = [];

		for (const prediction of turnPredictions) {
			if (prediction.evaluated) continue;

			let correct = false;

			switch (prediction.type) {
				case 'dicee':
					correct = outcome.wasDicee;
					break;
				case 'improves':
					correct = outcome.improved;
					break;
				case 'bricks':
					correct = outcome.bricked;
					break;
				case 'exact':
					correct = prediction.exactScore === outcome.finalScore;
					break;
			}

			const pointsAwarded = correct ? GameRoom.PREDICTION_POINTS[prediction.type] : 0;

			// Update prediction
			prediction.evaluated = true;
			prediction.correct = correct;
			prediction.pointsAwarded = pointsAwarded;

			// Update spectator stats
			this.updateSpectatorStats(prediction.spectatorId, correct, pointsAwarded);

			results.push({
				predictionId: prediction.id,
				correct,
				pointsAwarded,
				actualOutcome: outcome,
			});
		}

		// Broadcast results to spectators
		if (results.length > 0) {
			this.broadcastToSpectators({
				type: 'PREDICTION_RESULTS',
				payload: {
					turnNumber: this.currentTurn.turnNumber,
					playerId: outcome.playerId,
					results,
					outcome,
				},
			});
		}

		// Clear current turn
		this.currentTurn = null;

		return results;
	}

	/**
	 * Update spectator's prediction stats
	 */
	private updateSpectatorStats(spectatorId: string, correct: boolean, points: number): void {
		let stats = this.spectatorStats.get(spectatorId);
		if (!stats) {
			stats = this.createInitialStats(spectatorId);
		}

		stats.totalPredictions++;
		if (correct) {
			stats.correctPredictions++;
			stats.streak++;
			stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
		} else {
			stats.streak = 0;
		}
		stats.totalPoints += points;
		stats.accuracy = stats.totalPredictions > 0
			? stats.correctPredictions / stats.totalPredictions
			: 0;

		this.spectatorStats.set(spectatorId, stats);

		// Send updated stats to this spectator
		this.sendToUser(spectatorId, {
			type: 'PREDICTION_STATS_UPDATE',
			payload: stats,
		});
	}

	/**
	 * Get all spectator stats (for leaderboard)
	 */
	public getSpectatorLeaderboard(): SpectatorPredictionStats[] {
		return Array.from(this.spectatorStats.values())
			.sort((a, b) => b.totalPoints - a.totalPoints);
	}

	/**
	 * Clear predictions for a new game
	 */
	public clearPredictions(): void {
		this.predictions.clear();
		this.spectatorStats.clear();
		this.currentTurn = null;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Gallery Rooting System (D5)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle a spectator rooting for a player
	 */
	private handleRootForPlayer(
		ws: WebSocket,
		connState: ConnectionState,
		payload: { playerId: string },
	): void {
		// Only spectators can root
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can root for players');
			return;
		}

		// Validate player exists
		const playerIds = this.getConnectedUserIds();
		if (!playerIds.includes(payload.playerId)) {
			this.sendError(ws, 'INVALID_PLAYER', 'Invalid player ID');
			return;
		}

		// Check existing rooting choice
		const existing = this.rootingChoices.get(connState.userId);

		// Check rate limit
		if (existing && existing.changeCount >= GameRoom.MAX_ROOTING_CHANGES) {
			this.sendError(ws, 'ROOTING_LIMIT', `Maximum ${GameRoom.MAX_ROOTING_CHANGES} rooting changes per game`);
			return;
		}

		// Check if already rooting for this player
		if (existing && existing.playerId === payload.playerId) {
			this.sendError(ws, 'ALREADY_ROOTING', 'Already rooting for this player');
			return;
		}

		// Create or update rooting choice
		const choice: RootingChoice = {
			spectatorId: connState.userId,
			spectatorName: connState.displayName,
			playerId: payload.playerId,
			rootedAt: Date.now(),
			changeCount: existing ? existing.changeCount + 1 : 0,
		};

		this.rootingChoices.set(connState.userId, choice);

		// Send confirmation to spectator
		ws.send(JSON.stringify({
			type: 'ROOTING_CONFIRMED',
			payload: {
				playerId: payload.playerId,
				changeCount: choice.changeCount,
				remainingChanges: GameRoom.MAX_ROOTING_CHANGES - choice.changeCount,
			},
		}));

		// Broadcast rooting update to everyone
		this.broadcastRootingUpdate();

		console.log(`[GameRoom] ${connState.displayName} is now rooting for player ${payload.playerId}`);
	}

	/**
	 * Handle clearing rooting choice
	 */
	private handleClearRooting(ws: WebSocket, connState: ConnectionState): void {
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can clear rooting');
			return;
		}

		const existing = this.rootingChoices.get(connState.userId);
		if (!existing) {
			this.sendError(ws, 'NOT_ROOTING', 'Not currently rooting for anyone');
			return;
		}

		// Check rate limit (clearing counts as a change)
		if (existing.changeCount >= GameRoom.MAX_ROOTING_CHANGES) {
			this.sendError(ws, 'ROOTING_LIMIT', `Maximum ${GameRoom.MAX_ROOTING_CHANGES} rooting changes per game`);
			return;
		}

		// Update change count but remove the choice
		this.rootingChoices.delete(connState.userId);

		ws.send(JSON.stringify({
			type: 'ROOTING_CLEARED',
			payload: {
				previousPlayerId: existing.playerId,
			},
		}));

		// Broadcast rooting update
		this.broadcastRootingUpdate();

		console.log(`[GameRoom] ${connState.displayName} cleared their rooting choice`);
	}

	/**
	 * Handle get rooting request
	 */
	private handleGetRooting(ws: WebSocket): void {
		const connState = ws.deserializeAttachment() as ConnectionState;
		const update = this.buildRootingUpdate();

		// Include spectator's own choice if they have one
		const myChoice = connState.role === 'spectator'
			? this.rootingChoices.get(connState.userId)
			: null;

		ws.send(JSON.stringify({
			type: 'ROOTING_STATE',
			payload: {
				...update,
				myChoice: myChoice ? {
					playerId: myChoice.playerId,
					changeCount: myChoice.changeCount,
					remainingChanges: GameRoom.MAX_ROOTING_CHANGES - myChoice.changeCount,
				} : null,
			},
		}));
	}

	/**
	 * Build rooting update for broadcast
	 */
	private buildRootingUpdate(): RootingUpdate {
		// Group rooters by player
		const playerRooters = new Map<string, { count: number; names: string[] }>();

		// Initialize for all connected players
		for (const playerId of this.getConnectedUserIds()) {
			playerRooters.set(playerId, { count: 0, names: [] });
		}

		// Count rooters per player
		for (const choice of this.rootingChoices.values()) {
			const existing = playerRooters.get(choice.playerId);
			if (existing) {
				existing.count++;
				existing.names.push(choice.spectatorName);
			}
		}

		// Build player info array
		const players: PlayerRootingInfo[] = [];
		for (const [playerId, data] of playerRooters) {
			players.push({
				playerId,
				rooterCount: data.count,
				rooterNames: data.names,
			});
		}

		return {
			players,
			totalRooters: this.rootingChoices.size,
		};
	}

	/**
	 * Broadcast rooting update to all connections
	 */
	private broadcastRootingUpdate(): void {
		const update = this.buildRootingUpdate();
		this.broadcast({
			type: 'ROOTING_UPDATE',
			payload: update,
		});
	}

	/**
	 * Get rooting info for a specific player
	 */
	public getPlayerRootingInfo(playerId: string): PlayerRootingInfo {
		const rooters: string[] = [];
		for (const choice of this.rootingChoices.values()) {
			if (choice.playerId === playerId) {
				rooters.push(choice.spectatorName);
			}
		}
		return {
			playerId,
			rooterCount: rooters.length,
			rooterNames: rooters,
		};
	}

	/**
	 * Clear rooting for a new game
	 */
	public clearRooting(): void {
		this.rootingChoices.clear();
	}

	/**
	 * Award bonus points to spectators who rooted for the winner
	 * Called at game end
	 */
	public awardRootingBonus(winnerId: string, bonusPoints: number = 25): void {
		for (const choice of this.rootingChoices.values()) {
			if (choice.playerId === winnerId) {
				// Update spectator stats with bonus
				let stats = this.spectatorStats.get(choice.spectatorId);
				if (!stats) {
					stats = this.createInitialStats(choice.spectatorId);
				}
				stats.totalPoints += bonusPoints;
				this.spectatorStats.set(choice.spectatorId, stats);

				// Notify the spectator
				this.sendToUser(choice.spectatorId, {
					type: 'ROOTING_BONUS',
					payload: {
						winnerId,
						bonusPoints,
						totalPoints: stats.totalPoints,
					},
				});
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Gallery Kibitz System (D6)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle a kibitz vote from a spectator
	 */
	private handleKibitz(
		ws: WebSocket,
		connState: ConnectionState,
		payload: {
			playerId: string;
			voteType: KibitzVoteType;
			category?: string;
			keepPattern?: number;
			action?: 'roll' | 'score';
		},
	): void {
		// Only spectators can kibitz
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can kibitz');
			return;
		}

		// Must have an active turn
		if (!this.currentTurn) {
			this.sendError(ws, 'NO_ACTIVE_TURN', 'No active turn to kibitz on');
			return;
		}

		// Validate player matches current turn
		if (payload.playerId !== this.currentTurn.playerId) {
			this.sendError(ws, 'WRONG_PLAYER', 'Can only kibitz on the current player');
			return;
		}

		// Validate vote content based on type
		if (payload.voteType === 'category' && !payload.category) {
			this.sendError(ws, 'MISSING_CATEGORY', 'Category vote requires a category');
			return;
		}
		if (payload.voteType === 'keep' && payload.keepPattern === undefined) {
			this.sendError(ws, 'MISSING_KEEP_PATTERN', 'Keep vote requires a keep pattern');
			return;
		}
		if (payload.voteType === 'action' && !payload.action) {
			this.sendError(ws, 'MISSING_ACTION', 'Action vote requires an action');
			return;
		}

		// Create or update vote (one vote per spectator per turn)
		const vote: KibitzVote = {
			id: crypto.randomUUID(),
			spectatorId: connState.userId,
			spectatorName: connState.displayName,
			playerId: payload.playerId,
			voteType: payload.voteType,
			category: payload.category,
			keepPattern: payload.keepPattern,
			action: payload.action,
			timestamp: Date.now(),
		};

		this.kibitzVotes.set(connState.userId, vote);

		// Send confirmation
		ws.send(JSON.stringify({
			type: 'KIBITZ_CONFIRMED',
			payload: {
				voteType: payload.voteType,
				category: payload.category,
				keepPattern: payload.keepPattern,
				action: payload.action,
			},
		}));

		// Broadcast updated kibitz state
		this.broadcastKibitzUpdate(payload.voteType);

		console.log(`[GameRoom] ${connState.displayName} kibitzes: ${payload.voteType} = ${payload.category ?? payload.keepPattern ?? payload.action}`);
	}

	/**
	 * Handle clearing a kibitz vote
	 */
	private handleClearKibitz(ws: WebSocket, connState: ConnectionState): void {
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can clear kibitz');
			return;
		}

		const existing = this.kibitzVotes.get(connState.userId);
		if (!existing) {
			this.sendError(ws, 'NO_VOTE', 'No kibitz vote to clear');
			return;
		}

		const voteType = existing.voteType;
		this.kibitzVotes.delete(connState.userId);

		ws.send(JSON.stringify({
			type: 'KIBITZ_CLEARED',
			payload: { voteType },
		}));

		// Broadcast updated state
		this.broadcastKibitzUpdate(voteType);
	}

	/**
	 * Handle get kibitz state request
	 */
	private handleGetKibitz(ws: WebSocket): void {
		const state = this.buildKibitzState();

		ws.send(JSON.stringify({
			type: 'KIBITZ_STATE',
			payload: state,
		}));
	}

	/**
	 * Build aggregated kibitz state for broadcast
	 */
	private buildKibitzState(): KibitzState | null {
		if (!this.currentTurn) {
			return null;
		}

		// Group votes by type
		const categoryVotes = new Map<string, { count: number; voters: string[] }>();
		const keepVotes = new Map<number, { count: number; voters: string[] }>();
		const actionVotes = new Map<string, { count: number; voters: string[] }>();

		for (const vote of this.kibitzVotes.values()) {
			switch (vote.voteType) {
				case 'category':
					if (vote.category) {
						const existing = categoryVotes.get(vote.category) ?? { count: 0, voters: [] };
						existing.count++;
						existing.voters.push(vote.spectatorName);
						categoryVotes.set(vote.category, existing);
					}
					break;
				case 'keep':
					if (vote.keepPattern !== undefined) {
						const existing = keepVotes.get(vote.keepPattern) ?? { count: 0, voters: [] };
						existing.count++;
						existing.voters.push(vote.spectatorName);
						keepVotes.set(vote.keepPattern, existing);
					}
					break;
				case 'action':
					if (vote.action) {
						const existing = actionVotes.get(vote.action) ?? { count: 0, voters: [] };
						existing.count++;
						existing.voters.push(vote.spectatorName);
						actionVotes.set(vote.action, existing);
					}
					break;
			}
		}

		const totalVotes = this.kibitzVotes.size;

		// Build options arrays
		const categoryOptions = this.buildKibitzOptions(categoryVotes, totalVotes);
		const keepOptions = this.buildKeepPatternOptions(keepVotes, totalVotes);
		const actionOptions = this.buildKibitzOptions(actionVotes, totalVotes);

		// Determine active vote type (most votes)
		let activeVoteType: KibitzVoteType = 'category';
		let maxVotes = categoryOptions.reduce((sum, o) => sum + o.voteCount, 0);
		const keepVotesCount = keepOptions.reduce((sum, o) => sum + o.voteCount, 0);
		const actionVotesCount = actionOptions.reduce((sum, o) => sum + o.voteCount, 0);

		if (keepVotesCount > maxVotes) {
			activeVoteType = 'keep';
			maxVotes = keepVotesCount;
		}
		if (actionVotesCount > maxVotes) {
			activeVoteType = 'action';
		}

		return {
			playerId: this.currentTurn.playerId,
			turnNumber: this.currentTurn.turnNumber,
			totalVotes,
			activeVoteType,
			categoryOptions,
			keepOptions,
			actionOptions,
			votingOpen: true,
		};
	}

	/**
	 * Build options from vote map
	 */
	private buildKibitzOptions(
		votes: Map<string, { count: number; voters: string[] }>,
		totalVotes: number,
	): KibitzOption[] {
		const options: KibitzOption[] = [];

		for (const [optionId, data] of votes) {
			options.push({
				optionId,
				label: this.formatOptionLabel(optionId),
				voteCount: data.count,
				percentage: totalVotes > 0 ? Math.round((data.count / totalVotes) * 100) : 0,
				voterPreview: data.voters.slice(0, 3),
			});
		}

		// Sort by vote count descending
		return options.sort((a, b) => b.voteCount - a.voteCount);
	}

	/**
	 * Build keep pattern options with formatted labels
	 */
	private buildKeepPatternOptions(
		votes: Map<number, { count: number; voters: string[] }>,
		totalVotes: number,
	): KibitzOption[] {
		const options: KibitzOption[] = [];

		for (const [pattern, data] of votes) {
			options.push({
				optionId: pattern.toString(),
				label: this.formatKeepPattern(pattern),
				voteCount: data.count,
				percentage: totalVotes > 0 ? Math.round((data.count / totalVotes) * 100) : 0,
				voterPreview: data.voters.slice(0, 3),
			});
		}

		return options.sort((a, b) => b.voteCount - a.voteCount);
	}

	/**
	 * Format option label for display
	 */
	private formatOptionLabel(optionId: string): string {
		// Capitalize first letter of each word
		return optionId
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Format keep pattern bitmask to human-readable string
	 */
	private formatKeepPattern(pattern: number): string {
		if (pattern === 0) return 'Keep none';
		if (pattern === 31) return 'Keep all';

		const kept: number[] = [];
		for (let i = 0; i < 5; i++) {
			if (pattern & (1 << i)) {
				kept.push(i + 1);
			}
		}

		return `Keep dice ${kept.join(', ')}`;
	}

	/**
	 * Broadcast kibitz update to all connections
	 */
	private broadcastKibitzUpdate(voteType: KibitzVoteType): void {
		const state = this.buildKibitzState();
		if (!state) return;

		let options: KibitzOption[];
		switch (voteType) {
			case 'category':
				options = state.categoryOptions;
				break;
			case 'keep':
				options = state.keepOptions;
				break;
			case 'action':
				options = state.actionOptions;
				break;
		}

		const update: KibitzUpdate = {
			turnNumber: state.turnNumber,
			playerId: state.playerId,
			options,
			voteType,
			totalVotes: state.totalVotes,
		};

		this.broadcast({
			type: 'KIBITZ_UPDATE',
			payload: update,
		});
	}

	/**
	 * Clear kibitz votes for a new turn
	 * Called when turn changes
	 */
	public clearKibitz(): void {
		this.kibitzVotes.clear();
	}

	/**
	 * Get the leading kibitz suggestion for a vote type
	 */
	public getKibitzSuggestion(voteType: KibitzVoteType): KibitzOption | null {
		const state = this.buildKibitzState();
		if (!state) return null;

		let options: KibitzOption[];
		switch (voteType) {
			case 'category':
				options = state.categoryOptions;
				break;
			case 'keep':
				options = state.keepOptions;
				break;
			case 'action':
				options = state.actionOptions;
				break;
		}

		return options.length > 0 ? options[0] : null;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Spectator Reaction Handlers (D7)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle a spectator reaction
	 */
	private handleSpectatorReaction(
		ws: WebSocket,
		connState: ConnectionState,
		payload: {
			emoji: SpectatorReactionEmoji;
			targetPlayerId?: string;
		},
	): void {
		// Only spectators can use spectator reactions
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can send spectator reactions');
			return;
		}

		const { emoji, targetPlayerId } = payload;

		// Validate emoji is a valid reaction
		if (!this.isValidSpectatorReaction(emoji)) {
			this.sendError(ws, 'INVALID_EMOJI', 'Invalid reaction emoji');
			return;
		}

		// Check rate limit
		if (!this.checkReactionRateLimit(connState.userId)) {
			this.sendError(ws, 'RATE_LIMITED', 'Slow down! Too many reactions');
			return;
		}

		// Get reaction metadata
		const metadata = REACTION_METADATA[emoji];

		// Check if rooting-specific reaction
		if (metadata.requiresRooting) {
			const rootingChoice = this.rootingChoices.get(connState.userId);
			if (!rootingChoice) {
				this.sendError(ws, 'NOT_ROOTING', 'You must be rooting for a player to use this reaction');
				return;
			}
			// For rooting reactions, target must be the rooted player
			if (targetPlayerId && targetPlayerId !== rootingChoice.playerId) {
				this.sendError(ws, 'WRONG_PLAYER', 'You can only use rooting reactions for your backed player');
				return;
			}
		}

		// Create reaction
		const reaction: SpectatorReaction = {
			id: crypto.randomUUID(),
			spectatorId: connState.userId,
			spectatorName: connState.displayName,
			emoji,
			targetPlayerId,
			timestamp: Date.now(),
		};

		// Track for combo
		const comboCount = this.trackReactionCombo(emoji, connState.userId);

		// Determine if sound should play (first in combo or every 5th)
		const playSound = comboCount === 1 || comboCount % 5 === 0;

		// Build reaction event
		const reactionEvent: SpectatorReactionEvent = {
			reaction,
			comboCount,
			playSound,
		};

		// Broadcast to all spectators (and optionally players if room settings allow)
		this.broadcastSpectatorReaction(reactionEvent);

		// Send confirmation
		ws.send(JSON.stringify({
			type: 'REACTION_SENT',
			payload: {
				reactionId: reaction.id,
				emoji,
				comboCount,
			},
		}));
	}

	/**
	 * Check if an emoji is a valid spectator reaction
	 */
	private isValidSpectatorReaction(emoji: string): emoji is SpectatorReactionEmoji {
		return (
			(STANDARD_REACTIONS as readonly string[]).includes(emoji) ||
			(SPECTATOR_REACTIONS as readonly string[]).includes(emoji) ||
			(ROOTING_REACTIONS as readonly string[]).includes(emoji)
		);
	}

	/**
	 * Check and update reaction rate limit for a spectator
	 */
	private checkReactionRateLimit(spectatorId: string): boolean {
		const now = Date.now();
		let limit = this.reactionRateLimits.get(spectatorId);

		// Initialize if no limit exists
		if (!limit) {
			limit = {
				maxReactions: DEFAULT_REACTION_RATE_LIMIT.maxReactions,
				windowMs: DEFAULT_REACTION_RATE_LIMIT.windowMs,
				currentCount: 0,
				resetAt: now + DEFAULT_REACTION_RATE_LIMIT.windowMs,
			};
			this.reactionRateLimits.set(spectatorId, limit);
		}

		// Reset if window expired
		if (now >= limit.resetAt) {
			limit.currentCount = 0;
			limit.resetAt = now + limit.windowMs;
		}

		// Check if at limit
		if (limit.currentCount >= limit.maxReactions) {
			return false;
		}

		// Increment and allow
		limit.currentCount++;
		return true;
	}

	/**
	 * Track reaction for combo effect
	 * Returns current combo count for this emoji
	 */
	private trackReactionCombo(emoji: SpectatorReactionEmoji, spectatorId: string): number {
		const now = Date.now();
		const cutoff = now - GameRoom.REACTION_COMBO_WINDOW_MS;

		// Get existing reactions for this emoji
		let reactions = this.recentReactions.get(emoji) ?? [];

		// Filter out old reactions
		reactions = reactions.filter(r => r.timestamp > cutoff);

		// Add this reaction
		reactions.push({ timestamp: now, spectatorId });

		// Update map
		this.recentReactions.set(emoji, reactions);

		// Return combo count (unique spectators in window)
		const uniqueSpectators = new Set(reactions.map(r => r.spectatorId));
		return uniqueSpectators.size;
	}

	/**
	 * Broadcast spectator reaction to all clients
	 */
	private broadcastSpectatorReaction(event: SpectatorReactionEvent): void {
		// Broadcast to spectators with tag
		this.broadcastToSpectators({
			type: 'SPECTATOR_REACTION',
			payload: event,
		});

		// Also broadcast to players (they can see reactions)
		this.broadcastToPlayers({
			type: 'SPECTATOR_REACTION',
			payload: event,
		});
	}

	/**
	 * Get current reaction rate limit status for a spectator
	 */
	public getReactionRateLimit(spectatorId: string): ReactionRateLimit | null {
		return this.reactionRateLimits.get(spectatorId) ?? null;
	}

	/**
	 * Get current combo count for an emoji
	 */
	public getReactionCombo(emoji: SpectatorReactionEmoji): ReactionCombo | null {
		const now = Date.now();
		const cutoff = now - GameRoom.REACTION_COMBO_WINDOW_MS;
		const reactions = this.recentReactions.get(emoji);

		if (!reactions || reactions.length === 0) return null;

		// Filter to recent
		const recent = reactions.filter(r => r.timestamp > cutoff);
		if (recent.length === 0) return null;

		// Get unique spectator names (would need to look up, using IDs for now)
		const uniqueSpectators = [...new Set(recent.map(r => r.spectatorId))];

		return {
			emoji,
			count: recent.length,
			spectatorNames: uniqueSpectators.slice(0, 3), // First 3 spectator IDs
			lastTimestamp: Math.max(...recent.map(r => r.timestamp)),
		};
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Join Queue System (D8)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle a spectator joining the queue for next game
	 */
	private async handleJoinQueue(ws: WebSocket, connState: ConnectionState): Promise<void> {
		// Only spectators can join the queue
		if (connState.role !== 'spectator') {
			this.sendError(ws, 'NOT_SPECTATOR', 'Only spectators can join the queue');
			return;
		}

		// Check if already in queue
		if (this.joinQueue.some(e => e.userId === connState.userId)) {
			this.sendError(ws, 'ALREADY_IN_QUEUE', 'Already in the join queue');
			return;
		}

		// Check queue size limit
		if (this.joinQueue.length >= MAX_QUEUE_SIZE) {
			this.sendError(ws, 'QUEUE_FULL', 'Join queue is full');
			return;
		}

		// Check if queue is open
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			this.sendError(ws, 'NO_ROOM', 'Room not found');
			return;
		}

		// Create queue entry
		const entry: JoinQueueEntry = {
			userId: connState.userId,
			displayName: connState.displayName,
			avatarSeed: connState.avatarSeed,
			position: this.joinQueue.length + 1,
			queuedAt: Date.now(),
		};

		this.joinQueue.push(entry);

		// Calculate if they'll get a spot
		const availableSpots = roomState.settings.maxPlayers - this.getConnectedUserIds().length;
		const willGetSpot = entry.position <= availableSpots;

		// Send confirmation
		ws.send(JSON.stringify({
			type: 'QUEUE_JOINED',
			payload: {
				position: entry.position,
				willGetSpot,
				totalQueued: this.joinQueue.length,
				availableSpots: Math.max(0, availableSpots),
			},
		}));

		// Broadcast queue update
		this.broadcastQueueUpdate(roomState);

		console.log(`[GameRoom] ${connState.displayName} joined queue at position ${entry.position}`);
	}

	/**
	 * Handle a spectator leaving the queue
	 */
	private handleLeaveQueue(ws: WebSocket, connState: ConnectionState): void {
		const index = this.joinQueue.findIndex(e => e.userId === connState.userId);
		if (index === -1) {
			this.sendError(ws, 'NOT_IN_QUEUE', 'Not in the join queue');
			return;
		}

		// Remove from queue
		this.joinQueue.splice(index, 1);

		// Reorder remaining entries
		this.reorderQueue();

		// Send confirmation
		ws.send(JSON.stringify({
			type: 'QUEUE_LEFT',
			payload: { previousPosition: index + 1 },
		}));

		// Broadcast queue update
		this.ctx.storage.get<RoomState>('room').then(roomState => {
			if (roomState) {
				this.broadcastQueueUpdate(roomState);
			}
		});

		console.log(`[GameRoom] ${connState.displayName} left the queue`);
	}

	/**
	 * Handle get queue state request
	 */
	private async handleGetQueue(ws: WebSocket): Promise<void> {
		const connState = ws.deserializeAttachment() as ConnectionState;
		const roomState = await this.ctx.storage.get<RoomState>('room');

		if (!roomState) {
			ws.send(JSON.stringify({
				type: 'QUEUE_STATE',
				payload: null,
			}));
			return;
		}

		const currentPlayerCount = this.getConnectedUserIds().length;
		const availableSpots = roomState.settings.maxPlayers - currentPlayerCount;

		// Find user's position in queue
		const myEntry = this.joinQueue.find(e => e.userId === connState.userId);

		const state: JoinQueueState = {
			queue: this.joinQueue,
			maxPlayers: roomState.settings.maxPlayers,
			currentPlayerCount,
			estimatedWaitMs: this.estimateWaitTime(roomState),
			queueOpen: roomState.status !== 'completed' && roomState.status !== 'abandoned',
		};

		ws.send(JSON.stringify({
			type: 'QUEUE_STATE',
			payload: {
				...state,
				myPosition: myEntry?.position ?? null,
				willGetSpot: myEntry ? myEntry.position <= availableSpots : false,
			},
		}));
	}

	/**
	 * Reorder queue positions after removal
	 */
	private reorderQueue(): void {
		this.joinQueue.forEach((entry, index) => {
			entry.position = index + 1;
		});
	}

	/**
	 * Broadcast queue update to all spectators
	 */
	private broadcastQueueUpdate(roomState: RoomState): void {
		const currentPlayerCount = this.getConnectedUserIds().length;
		const availableSpots = Math.max(0, roomState.settings.maxPlayers - currentPlayerCount);

		const update: JoinQueueUpdate = {
			queue: this.joinQueue,
			availableSpots,
			totalQueued: this.joinQueue.length,
		};

		this.broadcast({
			type: 'QUEUE_UPDATE',
			payload: update,
		});
	}

	/**
	 * Estimate wait time based on game progress
	 */
	private estimateWaitTime(roomState: RoomState): number | null {
		if (roomState.status !== 'playing' || !roomState.startedAt) {
			return null;
		}

		// Rough estimate: 13 rounds × ~30 seconds per round = 6.5 minutes
		// Adjust based on elapsed time
		const elapsed = Date.now() - roomState.startedAt;
		const avgGameTime = 13 * 30 * 1000; // 6.5 minutes

		const estimated = Math.max(0, avgGameTime - elapsed);
		return estimated;
	}

	/**
	 * Process warm seat transition when game ends
	 * Called when a game finishes to transition queued spectators to players
	 */
	public async processWarmSeat(): Promise<WarmSeatTransition | null> {
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) return null;

		// Get current players who want to stay
		const stayingPlayers: WarmSeatTransition['stayingPlayers'] = [];
		const roomCode = this.getRoomCode();

		for (const ws of this.ctx.getWebSockets(`player:${roomCode}`)) {
			const state = ws.deserializeAttachment() as ConnectionState;
			stayingPlayers.push({
				userId: state.userId,
				displayName: state.displayName,
				avatarSeed: state.avatarSeed,
			});
		}

		// Calculate available spots
		const availableSpots = roomState.settings.maxPlayers - stayingPlayers.length;

		if (availableSpots <= 0 || this.joinQueue.length === 0) {
			// No spots or no one in queue
			this.warmSeatTransition = null;
			return null;
		}

		// Get spectators from queue who will transition
		const transitioningCount = Math.min(availableSpots, this.joinQueue.length);
		const transitioning = this.joinQueue.splice(0, transitioningCount);

		// Reorder remaining queue
		this.reorderQueue();

		// Build transition data
		const transitioningUsers: WarmSeatTransition['transitioningUsers'] = transitioning.map(entry => ({
			userId: entry.userId,
			displayName: entry.displayName,
			avatarSeed: entry.avatarSeed,
			fromPosition: entry.position,
		}));

		this.warmSeatTransition = {
			transitioningUsers,
			stayingPlayers,
			countdownSeconds: WARM_SEAT_COUNTDOWN_SECONDS,
			startedAt: Date.now(),
		};

		// Broadcast warm seat transition
		this.broadcast({
			type: 'WARM_SEAT_TRANSITION',
			payload: this.warmSeatTransition,
		});

		// Notify specific users they're transitioning
		for (const user of transitioningUsers) {
			this.sendToUser(user.userId, {
				type: 'YOU_ARE_TRANSITIONING',
				payload: {
					fromPosition: user.fromPosition,
					countdownSeconds: WARM_SEAT_COUNTDOWN_SECONDS,
				},
			});
		}

		// Schedule alarm for countdown completion
		const alarmData: AlarmData = {
			type: 'ROOM_CLEANUP', // Reuse for warm seat completion
			metadata: { warmSeat: true },
		};
		await this.ctx.storage.put('alarm_data', alarmData);
		await this.ctx.storage.setAlarm(Date.now() + WARM_SEAT_COUNTDOWN_SECONDS * 1000);

		console.log(`[GameRoom] Warm seat transition: ${transitioningUsers.length} spectators becoming players`);

		return this.warmSeatTransition;
	}

	/**
	 * Complete the warm seat transition - actually convert spectators to players
	 * Called when countdown finishes
	 */
	public async completeWarmSeatTransition(): Promise<void> {
		if (!this.warmSeatTransition) return;

		const transition = this.warmSeatTransition;
		this.warmSeatTransition = null;

		// Convert each transitioning spectator to a player
		for (const user of transition.transitioningUsers) {
			const sockets = this.ctx.getWebSockets(`user:${user.userId}`);
			for (const ws of sockets) {
				const state = ws.deserializeAttachment() as ConnectionState;

				// Update role to player
				state.role = 'player';
				ws.serializeAttachment(state);

				// Notify the user
				ws.send(JSON.stringify({
					type: 'TRANSITION_COMPLETE',
					payload: {
						newRole: 'player',
						message: 'You are now a player!',
					},
				}));
			}
		}

		// Update room state
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (roomState) {
			// Add transitioning users to player order
			for (const user of transition.transitioningUsers) {
				if (!roomState.playerOrder.includes(user.userId)) {
					roomState.playerOrder.push(user.userId);
				}
			}

			// Reset room for new game
			roomState.status = 'waiting';
			roomState.startedAt = null;

			await this.ctx.storage.put('room', roomState);
		}

		// Broadcast the completion
		this.broadcast({
			type: 'WARM_SEAT_COMPLETE',
			payload: {
				newPlayers: transition.transitioningUsers.map(u => ({
					userId: u.userId,
					displayName: u.displayName,
					avatarSeed: u.avatarSeed,
				})),
				totalPlayers: this.getConnectedUserIds().length + transition.transitioningUsers.length,
			},
		});

		// Notify lobby of player count change
		await this.notifyLobbyOfUpdate();

		console.log('[GameRoom] Warm seat transition complete');
	}

	/**
	 * Remove a user from queue when they disconnect
	 */
	private removeFromQueueOnDisconnect(userId: string): void {
		const index = this.joinQueue.findIndex(e => e.userId === userId);
		if (index !== -1) {
			this.joinQueue.splice(index, 1);
			this.reorderQueue();

			// Broadcast update
			this.ctx.storage.get<RoomState>('room').then(roomState => {
				if (roomState) {
					this.broadcastQueueUpdate(roomState);
				}
			});
		}
	}

	/**
	 * Get current queue state (for external queries)
	 */
	public getJoinQueueState(): JoinQueueEntry[] {
		return [...this.joinQueue];
	}

	/**
	 * Clear the join queue (for new room or cleanup)
	 */
	public clearJoinQueue(): void {
		this.joinQueue = [];
		this.warmSeatTransition = null;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Gallery Points System (D9)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Handle request for gallery points
	 */
	private handleGetGalleryPoints(ws: WebSocket, connState: ConnectionState): void {
		const points = this.getSpectatorGalleryPoints(connState.userId);
		const total = calculateTotalPoints(points);

		ws.send(JSON.stringify({
			type: 'GALLERY_POINTS',
			payload: {
				points,
				totalPoints: total,
				spectatorId: connState.userId,
			},
		}));
	}

	/**
	 * Get or create gallery points for a spectator
	 */
	private getSpectatorGalleryPoints(spectatorId: string): GalleryPoints {
		let points = this.gameGalleryPoints.get(spectatorId);
		if (!points) {
			points = createEmptyGalleryPoints();
			this.gameGalleryPoints.set(spectatorId, points);
		}
		return points;
	}

	/**
	 * Get or create point caps for a spectator
	 */
	private getPointCaps(spectatorId: string): { reactions: number; chat: number } {
		let caps = this.gamePointCaps.get(spectatorId);
		if (!caps) {
			caps = { reactions: 0, chat: 0 };
			this.gamePointCaps.set(spectatorId, caps);
		}
		return caps;
	}

	/**
	 * Award prediction points to a spectator
	 */
	public awardPredictionPoints(
		spectatorId: string,
		predictionType: PredictionType,
		isCorrect: boolean,
		streakBonus: number = 0,
	): number {
		if (!isCorrect) return 0;

		const points = this.getSpectatorGalleryPoints(spectatorId);
		let awarded = 0;

		// Base points by type
		if (predictionType === 'dicee') {
			awarded = GALLERY_POINT_VALUES.PREDICTION_DICEE;
		} else if (predictionType === 'exact') {
			awarded = GALLERY_POINT_VALUES.PREDICTION_EXACT_SCORE;
			points.predictions.exactScore += awarded;
		} else {
			awarded = GALLERY_POINT_VALUES.PREDICTION_CORRECT_BASE;
		}

		points.predictions.correct += awarded;

		// Streak bonus
		if (streakBonus > 0) {
			const bonus = Math.floor(awarded * GALLERY_POINT_VALUES.PREDICTION_STREAK_MULTIPLIER * streakBonus);
			points.predictions.streakBonus += bonus;
			awarded += bonus;
		}

		this.gameGalleryPoints.set(spectatorId, points);
		this.notifyPointsUpdate(spectatorId, points);

		return awarded;
	}

	/**
	 * Award reaction points to a spectator
	 */
	public awardReactionPoints(spectatorId: string): number {
		const caps = this.getPointCaps(spectatorId);

		// Check cap
		if (caps.reactions >= GALLERY_POINT_VALUES.MAX_REACTION_POINTS_PER_GAME) {
			return 0;
		}

		const points = this.getSpectatorGalleryPoints(spectatorId);
		points.social.reactionsGiven += GALLERY_POINT_VALUES.REACTION_GIVEN;
		caps.reactions += GALLERY_POINT_VALUES.REACTION_GIVEN;

		this.gameGalleryPoints.set(spectatorId, points);
		this.gamePointCaps.set(spectatorId, caps);

		return GALLERY_POINT_VALUES.REACTION_GIVEN;
	}

	/**
	 * Award kibitz points when in majority
	 */
	public awardKibitzPoints(spectatorId: string): number {
		const points = this.getSpectatorGalleryPoints(spectatorId);
		points.social.kibitzVotes += GALLERY_POINT_VALUES.KIBITZ_MAJORITY;
		this.gameGalleryPoints.set(spectatorId, points);
		this.notifyPointsUpdate(spectatorId, points);

		return GALLERY_POINT_VALUES.KIBITZ_MAJORITY;
	}

	/**
	 * Award chat message points
	 */
	public awardChatPoints(spectatorId: string): number {
		const caps = this.getPointCaps(spectatorId);

		// Check cap
		if (caps.chat >= GALLERY_POINT_VALUES.MAX_CHAT_POINTS_PER_GAME) {
			return 0;
		}

		const points = this.getSpectatorGalleryPoints(spectatorId);
		points.social.chatMessages += GALLERY_POINT_VALUES.CHAT_MESSAGE;
		caps.chat += GALLERY_POINT_VALUES.CHAT_MESSAGE;

		this.gameGalleryPoints.set(spectatorId, points);
		this.gamePointCaps.set(spectatorId, caps);

		return GALLERY_POINT_VALUES.CHAT_MESSAGE;
	}

	/**
	 * Award backing winner points at game end
	 */
	public awardBackingWinnerPoints(spectatorId: string, wasUnderdog: boolean = false): number {
		const points = this.getSpectatorGalleryPoints(spectatorId);
		let awarded = GALLERY_POINT_VALUES.BACKED_WINNER;
		points.backing.backedWinner += awarded;

		if (wasUnderdog) {
			points.backing.loyaltyBonus += GALLERY_POINT_VALUES.UNDERDOG_BONUS;
			awarded += GALLERY_POINT_VALUES.UNDERDOG_BONUS;
		}

		this.gameGalleryPoints.set(spectatorId, points);
		this.notifyPointsUpdate(spectatorId, points);

		return awarded;
	}

	/**
	 * Notify spectator of points update
	 */
	private notifyPointsUpdate(spectatorId: string, points: GalleryPoints): void {
		this.sendToUser(spectatorId, {
			type: 'GALLERY_POINTS_UPDATE',
			payload: {
				points,
				totalPoints: calculateTotalPoints(points),
			},
		});
	}

	/**
	 * Check and unlock achievements for a spectator
	 */
	public checkAchievements(
		spectatorId: string,
		stats: {
			predictionStreak?: number;
			gamesWithComeback?: number;
			samePlayerBackings?: number;
			lostPickStreak?: number;
			exactPredictions?: number;
			predictedDicee?: boolean;
			gamesWatched?: number;
			roomsVisited?: number;
		},
	): GalleryAchievementId[] {
		const unlocked: GalleryAchievementId[] = [];

		// Oracle: 5 correct predictions in a row
		if (stats.predictionStreak && stats.predictionStreak >= GALLERY_ACHIEVEMENTS.oracle.threshold) {
			unlocked.push('oracle');
		}

		// Drama Magnet: 10 games with comeback
		if (stats.gamesWithComeback && stats.gamesWithComeback >= GALLERY_ACHIEVEMENTS.drama_magnet.threshold) {
			unlocked.push('drama_magnet');
		}

		// Superfan: Backed same player 5 times
		if (stats.samePlayerBackings && stats.samePlayerBackings >= GALLERY_ACHIEVEMENTS.superfan.threshold) {
			unlocked.push('superfan');
		}

		// Jinx: Pick lost 5 times in a row
		if (stats.lostPickStreak && stats.lostPickStreak >= GALLERY_ACHIEVEMENTS.jinx.threshold) {
			unlocked.push('jinx');
		}

		// Analyst: Predicted exact score 3 times
		if (stats.exactPredictions && stats.exactPredictions >= GALLERY_ACHIEVEMENTS.analyst.threshold) {
			unlocked.push('analyst');
		}

		// Called It: Predicted a Dicee correctly
		if (stats.predictedDicee) {
			unlocked.push('called_it');
		}

		// Voyeur: Watched 50 games
		if (stats.gamesWatched && stats.gamesWatched >= GALLERY_ACHIEVEMENTS.voyeur.threshold) {
			unlocked.push('voyeur');
		}

		// Regular: Spectated in 20 rooms
		if (stats.roomsVisited && stats.roomsVisited >= GALLERY_ACHIEVEMENTS.regular.threshold) {
			unlocked.push('regular');
		}

		// Notify of unlocked achievements
		if (unlocked.length > 0) {
			this.sendToUser(spectatorId, {
				type: 'ACHIEVEMENTS_UNLOCKED',
				payload: {
					achievements: unlocked.map(id => ({
						...GALLERY_ACHIEVEMENTS[id],
						unlocked: true,
						unlockedAt: Date.now(),
					})),
				},
			});
		}

		return unlocked;
	}

	/**
	 * Get all gallery points for the current game
	 */
	public getAllGameGalleryPoints(): Map<string, GalleryPoints> {
		return new Map(this.gameGalleryPoints);
	}

	/**
	 * Clear gallery points for a new game
	 */
	public clearGameGalleryPoints(): void {
		this.gameGalleryPoints.clear();
		this.gamePointCaps.clear();
	}

	/**
	 * Finalize gallery points at game end and prepare for persistence
	 */
	public async finalizeGalleryPoints(winnerId: string): Promise<Map<string, { points: GalleryPoints; total: number }>> {
		const results = new Map<string, { points: GalleryPoints; total: number }>();

		// Award backing winner points
		for (const [spectatorId, choice] of this.rootingChoices) {
			if (choice.playerId === winnerId) {
				// Check if underdog (was behind at some point)
				const wasUnderdog = false; // Would need game state to determine
				this.awardBackingWinnerPoints(spectatorId, wasUnderdog);
			}
		}

		// Compile final results
		for (const [spectatorId, points] of this.gameGalleryPoints) {
			results.set(spectatorId, {
				points,
				total: calculateTotalPoints(points),
			});
		}

		// Broadcast final standings
		this.broadcastToSpectators({
			type: 'GALLERY_GAME_SUMMARY',
			payload: {
				results: Array.from(results.entries()).map(([id, data]) => ({
					spectatorId: id,
					...data,
				})).sort((a, b) => b.total - a.total),
			},
		});

		return results;
	}
}
