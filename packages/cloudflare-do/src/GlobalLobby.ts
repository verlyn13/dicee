/**
 * GlobalLobby Durable Object
 *
 * Singleton DO that manages the global game lobby:
 * - Global chat (lobby-wide messages)
 * - Presence tracking (who's online)
 * - Room browser (list of available rooms)
 * - Real-time updates via WebSocket
 *
 * Uses WebSocket hibernation for cost efficiency - only charged when
 * actively processing messages, not for idle connections.
 *
 * HIBERNATION-SAFE ARCHITECTURE (2025 best practices):
 * - Tags on acceptWebSocket for user grouping (survives hibernation)
 * - Attachments for per-connection metadata (survives hibernation)
 * - Constructor rebuilds in-memory state from getWebSockets()
 * - Auto ping/pong via setWebSocketAutoResponse (no wake needed)
 * - No manual WebSocket collections that won't survive hibernation
 */

import { DurableObject } from 'cloudflare:workers';
import { createLogger, type Logger } from './lib/logger';
import { createRoomDirectory, type RoomDirectory, type RoomInfo } from './lib/room-directory';
import type {
	Env,
	GameHighlight,
	GameRoomRpcStub,
	InviteCancellationRequest,
	InviteDeliveryRequest,
	JoinRequestResponseDelivery,
	PlayerSummary,
	RoomStatusUpdate,
} from './types';

// =============================================================================
// Types
// =============================================================================

/** User presence info stored in WebSocket attachment */
interface UserPresence {
	userId: string;
	displayName: string;
	avatarSeed: string;
	connectedAt: number;
	lastSeen: number;
	/** Room code the user is currently in (null if just in lobby) */
	currentRoomCode: string | null;
}

/** Message sent/received through the lobby */
interface LobbyMessage {
	type:
		| 'chat'
		| 'presence'
		| 'room_update'
		| 'rooms_list'
		| 'online_users'
		| 'highlight'
		| 'error'
		| 'pong'
		| 'invite_received'
		| 'invite_cancelled';
	payload: unknown;
	timestamp: number;
}

/** Chat message structure */
interface ChatMessage {
	id: string;
	userId: string;
	displayName: string;
	content: string;
	timestamp: number;
}

// RoomInfo is imported from './lib/room-directory'

/** Client command structure */
interface LobbyCommand {
	type:
		| 'chat'
		| 'ping'
		| 'get_rooms'
		| 'get_online_users'
		| 'room_created'
		| 'room_updated'
		| 'room_closed'
		| 'request_join'
		| 'cancel_join_request';
	content?: string;
	room?: RoomInfo;
	code?: string;
	/** Room code for join requests */
	roomCode?: string;
	/** Request ID for cancellation */
	requestId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_CHAT_HISTORY = 50;
const RATE_LIMIT_MESSAGES_PER_MINUTE = 30;

/** Storage keys for persistent data */
const STORAGE_KEYS = {
	CHAT_HISTORY: 'lobby:chatHistory',
} as const;

// =============================================================================
// GlobalLobby Class
// =============================================================================

export class GlobalLobby extends DurableObject<Env> {
	/** Structured logger for observability */
	private logger: Logger = createLogger({ component: 'GlobalLobby' });

	/** Storage-first room directory (survives hibernation) */
	private roomDirectory: RoomDirectory;

	/** Recent chat messages (in-memory cache, persisted to storage) */
	private chatHistory: ChatMessage[] = [];

	/** Whether chat history has been loaded from storage (for hibernation recovery) */
	private chatHistoryLoaded = false;

	/** Rate limiting: userId -> message timestamps (ephemeral, resets on hibernation) */
	private rateLimits: Map<string, number[]> = new Map();

	// =========================================================================
	// Constructor - Hibernation Recovery
	// =========================================================================

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize storage-first room directory (survives hibernation)
		this.roomDirectory = createRoomDirectory(ctx.storage);

		// Set up auto ping/pong without waking the DO
		// This handles keepalive efficiently - no compute charge for pings
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

		// Note: In-memory state (rateLimits) is lost on hibernation.
		// - roomDirectory: Persisted to storage, survives hibernation
		// - chatHistory: Persisted to storage, loaded lazily on first access
		// - rateLimits: Ephemeral by design - resets on wake (acceptable)
		//
		// User presence is derived from getWebSockets() + tags, which survive hibernation.
	}

	// =========================================================================
	// Main Entry Point
	// =========================================================================

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// WebSocket upgrade for real-time connection
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleWebSocketUpgrade(request);
		}

		// POST endpoints (called by GameRoom via RPC)
		if (request.method === 'POST') {
			if (url.pathname === '/user-room-status') {
				return this.handleUserRoomStatus(request);
			}
		}

		// REST endpoints
		switch (url.pathname) {
			case '/lobby':
			case '/lobby/':
				return await this.getLobbyInfo();
			case '/lobby/rooms':
				return await this.getPublicRooms();
			case '/lobby/online':
				return this.getOnlineCount();
			default:
				return new Response('Not Found', { status: 404 });
		}
	}

	// =========================================================================
	// WebSocket Connection
	// =========================================================================

	private async handleWebSocketUpgrade(request: Request): Promise<Response> {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Extract user info from headers (set by auth middleware or query params)
		const url = new URL(request.url);
		const userId =
			url.searchParams.get('userId') || request.headers.get('X-User-Id') || crypto.randomUUID();
		const displayName =
			url.searchParams.get('displayName') ||
			request.headers.get('X-Display-Name') ||
			`Guest-${userId.slice(0, 4)}`;
		const avatarSeed =
			url.searchParams.get('avatarSeed') || request.headers.get('X-Avatar-Seed') || userId;

		// Accept with hibernation support and tags for efficient querying
		// Tags survive hibernation and allow: getWebSockets('user:xyz')
		this.ctx.acceptWebSocket(server, [`user:${userId}`]);

		// Store session info as WebSocket attachment (survives hibernation)
		const presence: UserPresence = {
			userId,
			displayName,
			avatarSeed,
			connectedAt: Date.now(),
			lastSeen: Date.now(),
			currentRoomCode: null, // Will be updated when user enters a room
		};
		server.serializeAttachment(presence);

		// Check if this is the user's first connection (for join broadcast)
		// Use tags to query existing connections for this user
		const existingConnections = this.ctx.getWebSockets(`user:${userId}`);
		// Note: The new connection is already accepted, so it's included in the count
		const isNewUser = existingConnections.length === 1;

		// Send initial state to new connection (async for storage loading)
		await this.sendInitialState(server);

		// Only broadcast join if this is the user's first connection
		// (prevents "X joined" spam when same user opens multiple tabs)
		if (isNewUser) {
			this.broadcast(
				{
					type: 'presence',
					payload: {
						action: 'join',
						userId,
						displayName,
						avatarSeed,
						onlineCount: this.getUniqueUserCount(),
					},
					timestamp: Date.now(),
				},
				server,
			);

			// Broadcast updated online users list to ALL clients
			// This enables features like the invite modal showing current online users
			this.broadcastOnlineUsers();
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	private async sendInitialState(ws: WebSocket): Promise<void> {
		// Send current online count (unique users, not connections)
		// Derived from WebSocket tags - hibernation safe
		ws.send(
			JSON.stringify({
				type: 'presence',
				payload: {
					action: 'init',
					onlineCount: this.getUniqueUserCount(),
				},
				timestamp: Date.now(),
			}),
		);

		// Send recent chat history (load from storage if needed for hibernation recovery)
		const chatHistory = await this.loadChatHistory();
		if (chatHistory.length > 0) {
			ws.send(
				JSON.stringify({
					type: 'chat',
					payload: {
						action: 'history',
						messages: chatHistory.slice(-20),
					},
					timestamp: Date.now(),
				}),
			);
		}

		// Send current rooms list (storage-first: survives hibernation)
		const publicRooms = await this.roomDirectory.getPublic();
		if (publicRooms.length > 0) {
			ws.send(
				JSON.stringify({
					type: 'rooms_list',
					payload: { rooms: publicRooms },
					timestamp: Date.now(),
				}),
			);
		}
	}

	// =========================================================================
	// Hibernation API Handlers
	// =========================================================================

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const attachment = ws.deserializeAttachment() as UserPresence;

		// Update last seen
		attachment.lastSeen = Date.now();
		ws.serializeAttachment(attachment);

		try {
			const data = JSON.parse(message as string) as LobbyCommand;

			switch (data.type) {
				case 'chat':
					await this.handleChat(ws, attachment, data.content || '');
					break;
				// Note: 'ping' is handled automatically by setWebSocketAutoResponse
				// No need for manual ping handler - saves compute costs
				case 'get_rooms':
					await this.sendRoomsList(ws);
					break;
				case 'get_online_users':
					console.log('[GlobalLobby] Received get_online_users request');
					this.sendOnlineUsers(ws);
					break;
				case 'room_created':
					if (data.room) {
						// Storage-first: persist BEFORE broadcast
						await this.roomDirectory.upsert(data.room);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'created', room: data.room },
							timestamp: Date.now(),
						});
					}
					break;
				case 'room_updated':
					if (data.room) {
						// Storage-first: persist BEFORE broadcast
						await this.roomDirectory.upsert(data.room);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'updated', room: data.room },
							timestamp: Date.now(),
						});
					}
					break;
				case 'room_closed':
					if (data.code) {
						// Storage-first: persist BEFORE broadcast
						await this.roomDirectory.remove(data.code);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'closed', code: data.code },
							timestamp: Date.now(),
						});
					}
					break;
				case 'request_join':
					if (data.roomCode) {
						await this.handleRequestJoin(ws, attachment, data.roomCode);
					} else {
						ws.send(
							JSON.stringify({
								type: 'error',
								payload: { message: 'roomCode is required for join requests' },
								timestamp: Date.now(),
							}),
						);
					}
					break;
				case 'cancel_join_request':
					if (data.requestId && data.roomCode) {
						await this.handleCancelJoinRequest(ws, attachment, data.requestId, data.roomCode);
					} else {
						ws.send(
							JSON.stringify({
								type: 'error',
								payload: { message: 'requestId and roomCode are required' },
								timestamp: Date.now(),
							}),
						);
					}
					break;
				default:
					console.warn('[GlobalLobby] Unknown command type:', data.type);
			}
		} catch (e) {
			console.error('[GlobalLobby] Message parse error:', e);
			ws.send(
				JSON.stringify({
					type: 'error',
					payload: { message: 'Invalid message format' },
					timestamp: Date.now(),
				}),
			);
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
		const attachment = ws.deserializeAttachment() as UserPresence | null;

		if (attachment) {
			const { userId, displayName } = attachment;

			// Check if user has other connections still open
			// Use tags for hibernation-safe querying
			// Note: The closing connection is still in the list until this handler completes
			const remainingConnections = this.ctx.getWebSockets(`user:${userId}`);
			const isLastConnection = remainingConnections.length <= 1;

			if (isLastConnection) {
				// User fully disconnected - clean up ephemeral state
				this.rateLimits.delete(userId);

				// Broadcast leave only when user's last connection closes
				this.broadcast(
					{
						type: 'presence',
						payload: {
							action: 'leave',
							userId,
							displayName,
							// Subtract 1 because closing connection is still counted
							onlineCount: this.getUniqueUserCount() - 1,
						},
						timestamp: Date.now(),
					},
					ws,
				);

				// Broadcast updated online users list to ALL clients
				// This ensures features like invite modal stay current
				this.broadcastOnlineUsers();
			}
			// If user has other tabs open, no presence change - silent close
		}

		console.log(`[GlobalLobby] WebSocket closed: ${code} - ${reason}`);
	}

	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		console.error('[GlobalLobby] WebSocket error:', error);
		ws.close(1011, 'Internal error');
	}

	// =========================================================================
	// Chat Handling
	// =========================================================================

	/**
	 * Load chat history from storage (lazy loading for hibernation recovery).
	 * Uses storage-first pattern to ensure messages persist across hibernation.
	 */
	private async loadChatHistory(): Promise<ChatMessage[]> {
		if (!this.chatHistoryLoaded) {
			const stored = await this.ctx.storage.get<ChatMessage[]>(STORAGE_KEYS.CHAT_HISTORY);
			this.chatHistory = stored ?? [];
			this.chatHistoryLoaded = true;
		}
		return this.chatHistory;
	}

	/**
	 * Save chat message using storage-first pattern.
	 * Storage → Memory → Broadcast (ensures persistence before any client sees it)
	 */
	private async saveChatMessage(message: ChatMessage): Promise<void> {
		// Load existing history from storage (handles hibernation recovery)
		const history = await this.loadChatHistory();

		// Add new message
		history.push(message);

		// Trim to max history size
		if (history.length > MAX_CHAT_HISTORY) {
			this.chatHistory = history.slice(-MAX_CHAT_HISTORY);
		} else {
			this.chatHistory = history;
		}

		// Persist to storage FIRST (storage-first pattern)
		await this.ctx.storage.put(STORAGE_KEYS.CHAT_HISTORY, this.chatHistory);
	}

	private async handleChat(ws: WebSocket, user: UserPresence, content: string): Promise<void> {
		// Validate content
		if (!content || content.trim().length === 0) {
			return;
		}

		if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
			ws.send(
				JSON.stringify({
					type: 'error',
					payload: { message: `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} chars)` },
					timestamp: Date.now(),
				}),
			);
			return;
		}

		// Check rate limit
		if (!this.checkRateLimit(user.userId)) {
			ws.send(
				JSON.stringify({
					type: 'error',
					payload: { message: 'Rate limit exceeded. Please slow down.' },
					timestamp: Date.now(),
				}),
			);
			return;
		}

		const chatMessage: ChatMessage = {
			id: crypto.randomUUID(),
			userId: user.userId,
			displayName: user.displayName,
			content: content.trim(),
			timestamp: Date.now(),
		};

		// Storage-first: Save to storage before broadcasting
		await this.saveChatMessage(chatMessage);

		// Broadcast to all
		this.broadcast({
			type: 'chat',
			payload: {
				action: 'message',
				message: chatMessage,
			},
			timestamp: Date.now(),
		});
	}

	private checkRateLimit(userId: string): boolean {
		const now = Date.now();
		const windowMs = 60000; // 1 minute

		let timestamps = this.rateLimits.get(userId) || [];

		// Remove old timestamps
		timestamps = timestamps.filter((t) => now - t < windowMs);

		if (timestamps.length >= RATE_LIMIT_MESSAGES_PER_MINUTE) {
			return false;
		}

		timestamps.push(now);
		this.rateLimits.set(userId, timestamps);
		return true;
	}

	// =========================================================================
	// Room Management
	// =========================================================================

	private async sendRoomsList(ws: WebSocket): Promise<void> {
		// Get all public rooms (both waiting and playing) - storage-first
		const publicRooms = (await this.roomDirectory.getPublic()).sort((a, b) => {
			// Playing games first, then waiting, then by activity
			if (a.status !== b.status) {
				if (a.status === 'playing') return -1;
				if (b.status === 'playing') return 1;
			}
			// Then by spectator count (more popular first)
			if (a.spectatorCount !== b.spectatorCount) {
				return b.spectatorCount - a.spectatorCount;
			}
			// Then by most recent
			return b.updatedAt - a.updatedAt;
		});

		ws.send(
			JSON.stringify({
				type: 'rooms_list',
				payload: { rooms: publicRooms },
				timestamp: Date.now(),
			}),
		);
	}

	/**
	 * Send list of online users to requesting client.
	 * Returns deduplicated list with display info.
	 */
	private sendOnlineUsers(ws: WebSocket): void {
		const rawUsers = this.getOnlineUsers();
		console.log('[GlobalLobby] sendOnlineUsers - raw users:', rawUsers.length);
		const users = rawUsers.map((u) => ({
			userId: u.userId,
			displayName: u.displayName,
			avatarSeed: u.avatarSeed,
			currentRoomCode: u.currentRoomCode,
		}));
		console.log('[GlobalLobby] sendOnlineUsers - sending users:', users);

		ws.send(
			JSON.stringify({
				type: 'online_users',
				payload: { users, count: users.length },
				timestamp: Date.now(),
			}),
		);
	}

	/**
	 * Broadcast online users list to ALL connected clients.
	 * Called after presence changes (join/leave/room status) so all clients stay up-to-date.
	 * This enables features like the invite modal showing current online users.
	 */
	private broadcastOnlineUsers(): void {
		const rawUsers = this.getOnlineUsers();
		const users = rawUsers.map((u) => ({
			userId: u.userId,
			displayName: u.displayName,
			avatarSeed: u.avatarSeed,
			currentRoomCode: u.currentRoomCode,
		}));

		this.broadcast({
			type: 'online_users',
			payload: { users, count: users.length },
			timestamp: Date.now(),
		});

		console.log(`[GlobalLobby] Broadcast online users: ${users.length} users to all clients`);
	}

	// =========================================================================
	// REST Endpoints
	// =========================================================================

	private async getLobbyInfo(): Promise<Response> {
		const allRooms = await this.roomDirectory.getAll();
		const publicRooms = await this.roomDirectory.getPublic();
		return Response.json({
			service: 'Game Lobby',
			onlineCount: this.getUniqueUserCount(),
			connectionCount: this.ctx.getWebSockets().length,
			roomCount: allRooms.length,
			publicRoomCount: publicRooms.length,
		});
	}

	private async getPublicRooms(): Promise<Response> {
		const rooms = (await this.roomDirectory.getPublic()).sort(
			(a, b) => b.createdAt - a.createdAt,
		);

		return Response.json({ rooms });
	}

	private getOnlineCount(): Response {
		return Response.json({
			count: this.getUniqueUserCount(),
			connections: this.ctx.getWebSockets().length,
		});
	}

	// =========================================================================
	// User Presence Helpers (Hibernation-Safe)
	// =========================================================================

	/**
	 * Get count of unique online users (not connections).
	 * A user with 3 tabs open counts as 1 user.
	 *
	 * HIBERNATION-SAFE: Derives count from WebSocket attachments,
	 * not from in-memory Maps that would be lost on wake.
	 */
	private getUniqueUserCount(): number {
		const seenUsers = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			const attachment = ws.deserializeAttachment() as UserPresence | null;
			if (attachment?.userId) {
				seenUsers.add(attachment.userId);
			}
		}
		return seenUsers.size;
	}

	/**
	 * Get list of unique online users with their presence info.
	 * Deduplicates across multiple tabs/connections per user.
	 */
	private getOnlineUsers(): UserPresence[] {
		const seenUsers = new Map<string, UserPresence>();
		for (const ws of this.ctx.getWebSockets()) {
			const attachment = ws.deserializeAttachment() as UserPresence | null;
			if (attachment?.userId && !seenUsers.has(attachment.userId)) {
				seenUsers.set(attachment.userId, attachment);
			}
		}
		return Array.from(seenUsers.values());
	}

	// =========================================================================
	// User Room Status (RPC for GameRoom)
	// =========================================================================

	/**
	 * Update user's room status.
	 * Updates the user's currentRoomCode in their WebSocket attachment and
	 * broadcasts updated online users list to all clients.
	 *
	 * Called by GameRoom when a user enters or leaves a room.
	 *
	 * @param userId - The user whose room status changed
	 * @param roomCode - The room code
	 * @param action - 'entered' when joining a room, 'left' when leaving
	 */
	updateUserRoomStatus(userId: string, roomCode: string, action: 'entered' | 'left'): void {
		// Find all WebSocket connections for this user
		const userConnections = this.ctx.getWebSockets(`user:${userId}`);

		if (userConnections.length === 0) {
			console.log(`[GlobalLobby] User ${userId} not connected, skipping room status update`);
			return;
		}

		// Update the user's attachment with their current room code
		for (const ws of userConnections) {
			const attachment = ws.deserializeAttachment() as UserPresence | null;
			if (attachment) {
				ws.serializeAttachment({
					...attachment,
					currentRoomCode: action === 'entered' ? roomCode : null,
				});
			}
		}

		// Broadcast updated online users list to all clients
		this.broadcastOnlineUsers();

		console.log(
			`[GlobalLobby] User ${userId} ${action} room ${roomCode}, broadcast updated online users`,
		);
	}

	/**
	 * HTTP handler for user room status (fallback for non-RPC callers).
	 */
	private async handleUserRoomStatus(request: Request): Promise<Response> {
		try {
			const body = (await request.json()) as {
				userId: string;
				roomCode: string;
				action: 'entered' | 'left';
			};

			this.updateUserRoomStatus(body.userId, body.roomCode, body.action);
			return new Response('OK');
		} catch (err) {
			console.error('[GlobalLobby] handleUserRoomStatus error:', err);
			return new Response('Bad Request', { status: 400 });
		}
	}

	// =========================================================================
	// RPC Methods (called by GameRoom DOs)
	// =========================================================================

	/**
	 * Update room status in the directory.
	 * Called by GameRoom on: player join/leave, spectator join/leave,
	 * game start, round change, game end.
	 */
	async updateRoomStatus(update: RoomStatusUpdate): Promise<void> {
		// Get existing room to preserve createdAt timestamp
		const existingRoom = await this.roomDirectory.get(update.roomCode);

		const roomInfo: RoomInfo = {
			code: update.roomCode,
			game: update.game,
			hostName: update.hostName,
			hostId: update.hostId,
			playerCount: update.playerCount,
			spectatorCount: update.spectatorCount,
			maxPlayers: update.maxPlayers,
			isPublic: update.isPublic,
			allowSpectators: update.allowSpectators,
			status: update.status,
			roundNumber: update.roundNumber,
			totalRounds: update.totalRounds,
			players: update.players,
			createdAt: existingRoom?.createdAt ?? update.updatedAt,
			updatedAt: update.updatedAt,
		};

		// Handle finished rooms
		if (update.status === 'finished') {
			// Keep finished games briefly for "recent results"
			this.scheduleRoomRemoval(update.roomCode, 60_000);
		}

		// Storage-first: persist BEFORE broadcast
		await this.roomDirectory.upsert(roomInfo);

		// Broadcast to lobby clients
		this.broadcast({
			type: 'room_update',
			payload: { action: 'updated', room: roomInfo },
			timestamp: Date.now(),
		});

		const roomCount = await this.roomDirectory.size();
		this.logger.info('Room status update received', {
			operation: 'room_update',
			roomCode: update.roomCode,
			status: update.status,
			playerCount: update.playerCount,
			spectatorCount: update.spectatorCount,
			activeRoomsCount: roomCount,
		});
	}

	/**
	 * Send a game highlight to lobby clients.
	 * Used for ticker events like Dicees, high scores, etc.
	 */
	sendHighlight(highlight: GameHighlight): void {
		this.broadcast({
			type: 'highlight',
			payload: highlight,
			timestamp: Date.now(),
		});

		console.log(`[GlobalLobby] Highlight: ${highlight.type} in room ${highlight.roomCode}`);
	}

	/**
	 * Remove a room from the directory.
	 * Called when a room closes or is abandoned.
	 */
	async removeRoom(roomCode: string): Promise<void> {
		// Storage-first: persist BEFORE broadcast
		await this.roomDirectory.remove(roomCode);

		this.broadcast({
			type: 'room_update',
			payload: { action: 'closed', code: roomCode },
			timestamp: Date.now(),
		});

		console.log(`[GlobalLobby] Room ${roomCode} removed from directory`);
	}

	/**
	 * Schedule a room to be removed after a delay.
	 * Used for finished games that should stay visible briefly.
	 */
	private scheduleRoomRemoval(roomCode: string, delayMs: number): void {
		// Note: Using setTimeout for simplicity. Could use DO alarms for persistence.
		setTimeout(async () => {
			const room = await this.roomDirectory.get(roomCode);
			if (room?.status === 'finished') {
				await this.removeRoom(roomCode);
			}
		}, delayMs);
	}

	// =========================================================================
	// Invite System RPC Methods
	// =========================================================================

	/**
	 * Check if a user is currently online in the lobby.
	 * Called by GameRoom to validate invite targets.
	 */
	isUserOnline(userId: string): boolean {
		const connections = this.ctx.getWebSockets(`user:${userId}`);
		return connections.length > 0;
	}

	/**
	 * Get online user info for display.
	 * Returns null if user is not online.
	 */
	getOnlineUserInfo(userId: string): { displayName: string; avatarSeed: string } | null {
		const connections = this.ctx.getWebSockets(`user:${userId}`);
		if (connections.length === 0) {
			return null;
		}

		// Get info from first connection's attachment
		const attachment = connections[0].deserializeAttachment() as UserPresence | null;
		if (!attachment) {
			return null;
		}

		return {
			displayName: attachment.displayName,
			avatarSeed: attachment.avatarSeed,
		};
	}

	/**
	 * Deliver a game invite to a specific online user.
	 * Called by GameRoom when host sends an invite.
	 *
	 * @returns true if the invite was delivered, false if user is offline
	 */
	deliverInvite(request: InviteDeliveryRequest): boolean {
		const connections = this.ctx.getWebSockets(`user:${request.targetUserId}`);

		if (connections.length === 0) {
			this.logger.info('Cannot deliver invite - user offline', {
				operation: 'deliver_invite',
				inviteId: request.inviteId,
				targetUserId: request.targetUserId,
				roomCode: request.roomCode,
				result: 'user_offline',
			});
			return false;
		}

		// Build INVITE_RECEIVED event payload
		const inviteEvent = {
			type: 'invite_received',
			payload: {
				inviteId: request.inviteId,
				roomCode: request.roomCode,
				hostUserId: request.hostUserId,
				hostDisplayName: request.hostDisplayName,
				hostAvatarSeed: request.hostAvatarSeed,
				game: request.game,
				playerCount: request.playerCount,
				maxPlayers: request.maxPlayers,
				expiresAt: request.expiresAt,
			},
			timestamp: Date.now(),
		};

		// Send to all of user's connections (they might have multiple tabs)
		const payload = JSON.stringify(inviteEvent);
		let delivered = false;

		for (const ws of connections) {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(payload);
					delivered = true;
				} catch (e) {
					this.logger.error('Failed to deliver invite', {
						operation: 'deliver_invite',
						inviteId: request.inviteId,
						targetUserId: request.targetUserId,
						error: String(e),
					});
				}
			}
		}

		if (delivered) {
			this.logger.info('Invite delivered successfully', {
				operation: 'deliver_invite',
				inviteId: request.inviteId,
				targetUserId: request.targetUserId,
				roomCode: request.roomCode,
				connectionsFound: connections.length,
				result: 'delivered',
			});
		}

		return delivered;
	}

	/**
	 * Cancel a pending invite for a user.
	 * Called by GameRoom when invite is cancelled, expired, or room becomes full.
	 */
	cancelInvite(request: InviteCancellationRequest): void {
		const connections = this.ctx.getWebSockets(`user:${request.targetUserId}`);

		if (connections.length === 0) {
			console.log(`[GlobalLobby] Cannot cancel invite - user ${request.targetUserId} is offline`);
			return;
		}

		// Build INVITE_CANCELLED event payload
		const cancelEvent = {
			type: 'invite_cancelled',
			payload: {
				inviteId: request.inviteId,
				roomCode: request.roomCode,
				reason: request.reason,
			},
			timestamp: Date.now(),
		};

		// Send to all of user's connections
		const payload = JSON.stringify(cancelEvent);

		for (const ws of connections) {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(payload);
				} catch (e) {
					console.error('[GlobalLobby] Failed to cancel invite:', e);
				}
			}
		}

		console.log(
			`[GlobalLobby] Invite ${request.inviteId} cancelled for user ${request.targetUserId}: ${request.reason}`,
		);
	}

	// =========================================================================
	// Join Request WebSocket Handlers
	// =========================================================================

	/**
	 * Handle a join request from a lobby user.
	 * Routes the request to the target GameRoom via RPC.
	 */
	private async handleRequestJoin(
		ws: WebSocket,
		user: UserPresence,
		roomCode: string,
	): Promise<void> {
		this.logger.info('Processing join request', {
			operation: 'request_join',
			requesterId: user.userId,
			roomCode,
		});

		// Validate room exists in directory (storage-first)
		const room = await this.roomDirectory.get(roomCode);
		if (!room) {
			ws.send(
				JSON.stringify({
					type: 'join_request_error',
					payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
					timestamp: Date.now(),
				}),
			);
			return;
		}

		// Get the GameRoom stub (cast for typed RPC)
		const roomId = this.env.GAME_ROOM.idFromName(roomCode);
		const roomStub = this.env.GAME_ROOM.get(roomId) as unknown as GameRoomRpcStub;

		try {
			// Call GameRoom's handleJoinRequest RPC
			const result = await roomStub.handleJoinRequest({
				requesterId: user.userId,
				requesterDisplayName: user.displayName,
				requesterAvatarSeed: user.avatarSeed,
			});

			if (result.success && result.request) {
				// Send confirmation to requester
				ws.send(
					JSON.stringify({
						type: 'join_request_sent',
						payload: {
							requestId: result.request.id,
							roomCode,
							expiresAt: result.request.expiresAt,
						},
						timestamp: Date.now(),
					}),
				);

				this.logger.info('Join request routed to room', {
					operation: 'request_join',
					requestId: result.request.id,
					requesterId: user.userId,
					roomCode,
					result: 'success',
				});
			} else {
				// Send error to requester
				ws.send(
					JSON.stringify({
						type: 'join_request_error',
						payload: {
							code: result.errorCode ?? 'UNKNOWN_ERROR',
							message: result.errorMessage ?? 'Failed to create join request',
						},
						timestamp: Date.now(),
					}),
				);

				this.logger.info('Join request failed', {
					operation: 'request_join',
					requesterId: user.userId,
					roomCode,
					errorCode: result.errorCode,
					result: 'error',
				});
			}
		} catch (error) {
			this.logger.error('Join request RPC error', {
				operation: 'request_join',
				requesterId: user.userId,
				roomCode,
				error: String(error),
			});

			ws.send(
				JSON.stringify({
					type: 'join_request_error',
					payload: { code: 'RPC_ERROR', message: 'Failed to contact game room' },
					timestamp: Date.now(),
				}),
			);
		}
	}

	/**
	 * Handle a join request cancellation from the requester.
	 * Routes the cancellation to the target GameRoom via RPC.
	 */
	private async handleCancelJoinRequest(
		ws: WebSocket,
		user: UserPresence,
		requestId: string,
		roomCode: string,
	): Promise<void> {
		this.logger.info('Processing join request cancellation', {
			operation: 'cancel_join_request',
			requestId,
			requesterId: user.userId,
			roomCode,
		});

		// Get the GameRoom stub (cast for typed RPC)
		const roomId = this.env.GAME_ROOM.idFromName(roomCode);
		const roomStub = this.env.GAME_ROOM.get(roomId) as unknown as GameRoomRpcStub;

		try {
			// Call GameRoom's cancelJoinRequest RPC
			const result = await roomStub.cancelJoinRequest(requestId, user.userId);

			if (result.success) {
				ws.send(
					JSON.stringify({
						type: 'join_request_cancelled',
						payload: { requestId },
						timestamp: Date.now(),
					}),
				);

				this.logger.info('Join request cancelled', {
					operation: 'cancel_join_request',
					requestId,
					requesterId: user.userId,
					result: 'success',
				});
			} else {
				ws.send(
					JSON.stringify({
						type: 'error',
						payload: {
							code: result.errorCode ?? 'CANCEL_FAILED',
							message: result.errorMessage ?? 'Failed to cancel request',
						},
						timestamp: Date.now(),
					}),
				);
			}
		} catch (error) {
			this.logger.error('Cancel join request RPC error', {
				operation: 'cancel_join_request',
				requestId,
				roomCode,
				error: String(error),
			});

			ws.send(
				JSON.stringify({
					type: 'error',
					payload: { code: 'RPC_ERROR', message: 'Failed to contact game room' },
					timestamp: Date.now(),
				}),
			);
		}
	}

	// =========================================================================
	// Join Request System RPC Methods
	// =========================================================================

	/**
	 * Deliver a join request response to a specific user.
	 * Called by GameRoom when host approves/declines or request expires.
	 *
	 * @returns true if delivered successfully, false if user is offline
	 */
	deliverJoinRequestResponse(response: JoinRequestResponseDelivery): boolean {
		const connections = this.ctx.getWebSockets(`user:${response.requesterId}`);

		if (connections.length === 0) {
			this.logger.info('Cannot deliver join request response - user offline', {
				operation: 'deliver_join_response',
				requestId: response.requestId,
				requesterId: response.requesterId,
				roomCode: response.roomCode,
				status: response.status,
				result: 'user_offline',
			});
			return false;
		}

		// Determine event type based on status
		const eventType =
			response.status === 'approved'
				? 'join_approved'
				: response.status === 'declined'
					? 'join_declined'
					: 'join_request_expired';

		// Build the event payload
		const joinResponseEvent = {
			type: eventType,
			payload: {
				requestId: response.requestId,
				roomCode: response.roomCode,
				...(response.reason && { reason: response.reason }),
			},
			timestamp: Date.now(),
		};

		// Send to all of user's connections
		const payload = JSON.stringify(joinResponseEvent);
		let delivered = false;

		for (const ws of connections) {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(payload);
					delivered = true;
				} catch (e) {
					this.logger.error('Failed to deliver join request response', {
						operation: 'deliver_join_response',
						requestId: response.requestId,
						requesterId: response.requesterId,
						error: String(e),
					});
				}
			}
		}

		if (delivered) {
			this.logger.info('Join request response delivered', {
				operation: 'deliver_join_response',
				requestId: response.requestId,
				requesterId: response.requesterId,
				roomCode: response.roomCode,
				status: response.status,
				connectionsFound: connections.length,
				result: 'delivered',
			});
		}

		return delivered;
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	private broadcast(message: LobbyMessage, exclude?: WebSocket): void {
		const payload = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(payload);
				} catch (e) {
					console.error('[GlobalLobby] Broadcast error:', e);
				}
			}
		}
	}
}
