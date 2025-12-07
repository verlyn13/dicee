/**
 * GameRoom Durable Object
 *
 * Handles multiplayer game room logic with hibernatable WebSockets.
 * This is the core game server - manages connections, game state, and broadcasts.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, ConnectionState, RoomState, PlayerInfo, AlarmData } from './types';
import { createInitialRoomState } from './types';
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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize chat manager
		this.chatManager = new ChatManager(ctx);

		// Set up auto-response for ping/pong without waking the DO
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
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

		// Verify JWT against Supabase JWKS
		const authResult = await verifySupabaseJWT(token, this.env.SUPABASE_URL);
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
		// Tags allow filtering connections: getWebSockets('user:abc123')
		const roomCode = this.getRoomCode();
		this.ctx.acceptWebSocket(serverSocket, [`user:${userId}`, `room:${roomCode}`]);

		// Attach state that survives hibernation
		const connectionState: ConnectionState = {
			userId,
			displayName,
			avatarSeed: avatarUrl ?? userId,
			connectedAt: Date.now(),
			isHost: false,
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
				// TODO (do-4): Handle turn timeout
				console.log('Turn timeout for user:', alarmData.userId);
				break;
			case 'AFK_CHECK':
				// TODO (do-4): Handle AFK check
				console.log('AFK check for user:', alarmData.userId);
				break;
			case 'ROOM_CLEANUP':
				// TODO: Implement room cleanup
				console.log('Room cleanup triggered');
				break;
		}

		await this.ctx.storage.delete('alarm_data');
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
		const payload = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
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
	 * Get all connected user IDs.
	 */
	private getConnectedUserIds(): string[] {
		const userIds = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			const state = ws.deserializeAttachment() as ConnectionState;
			userIds.add(state.userId);
		}
		return Array.from(userIds);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Connection Lifecycle
	// ─────────────────────────────────────────────────────────────────────────────

	private async onConnect(ws: WebSocket, connState: ConnectionState): Promise<void> {
		// Initialize chat manager (loads state from storage)
		await this.chatManager.initialize();

		// Load or initialize room state
		let roomState = await this.ctx.storage.get<RoomState>('room');

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
					roomStatus: roomState.status,
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
	}

	private async handleMessage(
		ws: WebSocket,
		connState: ConnectionState,
		message: { type: string; payload?: unknown },
	): Promise<void> {
		const { type, payload } = message;

		// Route chat-related messages through ChatManager
		if (isChatMessageType(type)) {
			await this.handleChatMessage(ws, connState, message);
			return;
		}

		switch (type) {
			case 'START_GAME':
				await this.handleStartGame(ws, connState);
				break;

			case 'PING':
				ws.send(JSON.stringify({ type: 'PONG', payload: Date.now() }));
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

		// Create system message for leave
		const reason = code === 1000 ? 'left' : 'disconnected';
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

		// Set AFK check alarm
		const alarmData: AlarmData = { type: 'AFK_CHECK', userId: connState.userId };
		await this.ctx.storage.put('alarm_data', alarmData);
		await this.ctx.storage.setAlarm(Date.now() + 60_000); // 60 second reconnect window
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Game Logic Handlers (stubs - full implementation in do-4)
	// ─────────────────────────────────────────────────────────────────────────────

	private async handleStartGame(ws: WebSocket, connState: ConnectionState): Promise<void> {
		if (!connState.isHost) {
			this.sendError(ws, 'NOT_HOST', 'Only the host can start the game');
			return;
		}

		const playerIds = this.getConnectedUserIds();
		if (playerIds.length < 2) {
			this.sendError(ws, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players');
			return;
		}

		// Update room status
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (roomState) {
			roomState.status = 'starting';
			roomState.startedAt = Date.now();
			await this.ctx.storage.put('room', roomState);
		}

		// TODO (do-4): Initialize full game state
		this.broadcast({ type: 'GAME_STARTING', payload: { playerCount: playerIds.length } });
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

		for (const ws of this.ctx.getWebSockets()) {
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

	private async handleRoomInfo(): Promise<Response> {
		const roomState = await this.ctx.storage.get<RoomState>('room');
		if (!roomState) {
			return new Response('Room not found', { status: 404 });
		}

		return Response.json({
			roomCode: roomState.roomCode,
			playerCount: this.getConnectedUserIds().length,
			maxPlayers: roomState.settings.maxPlayers,
			status: roomState.status,
			createdAt: roomState.createdAt,
		});
	}
}
