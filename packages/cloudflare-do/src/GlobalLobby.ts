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
import type { Env, RoomStatusUpdate, GameHighlight, PlayerSummary } from './types';

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
}

/** Message sent/received through the lobby */
interface LobbyMessage {
	type: 'chat' | 'presence' | 'room_update' | 'rooms_list' | 'highlight' | 'error' | 'pong';
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

/** Enhanced room info for room browser - now based on RoomStatusUpdate */
interface RoomInfo {
	code: string;
	game: string;
	hostName: string;
	hostId: string;
	playerCount: number;
	spectatorCount: number;
	maxPlayers: number;
	isPublic: boolean;
	allowSpectators: boolean;
	status: 'waiting' | 'playing' | 'finished';
	roundNumber: number;
	totalRounds: number;
	players: PlayerSummary[];
	createdAt: number;
	updatedAt: number;
}

/** Client command structure */
interface LobbyCommand {
	type: 'chat' | 'ping' | 'get_rooms' | 'room_created' | 'room_updated' | 'room_closed';
	content?: string;
	room?: RoomInfo;
	code?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_CHAT_HISTORY = 50;
const RATE_LIMIT_MESSAGES_PER_MINUTE = 30;

// =============================================================================
// GlobalLobby Class
// =============================================================================

export class GlobalLobby extends DurableObject<Env> {
	/** Active game rooms (in-memory, rebuilt from notifications) */
	private activeRooms: Map<string, RoomInfo> = new Map();

	/** Recent chat messages (in-memory cache) */
	private chatHistory: ChatMessage[] = [];

	/** Rate limiting: userId -> message timestamps (ephemeral, resets on hibernation) */
	private rateLimits: Map<string, number[]> = new Map();

	// =========================================================================
	// Constructor - Hibernation Recovery
	// =========================================================================

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Set up auto ping/pong without waking the DO
		// This handles keepalive efficiently - no compute charge for pings
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

		// Note: In-memory state (activeRooms, chatHistory, rateLimits) is lost on hibernation.
		// - activeRooms: Rebuilt from room notifications (acceptable for lobby)
		// - chatHistory: Could persist to storage if needed (TODO)
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

		// REST endpoints
		switch (url.pathname) {
			case '/lobby':
			case '/lobby/':
				return this.getLobbyInfo();
			case '/lobby/rooms':
				return this.getPublicRooms();
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
		const userId = url.searchParams.get('userId') || request.headers.get('X-User-Id') || crypto.randomUUID();
		const displayName = url.searchParams.get('displayName') || request.headers.get('X-Display-Name') || `Guest-${userId.slice(0, 4)}`;
		const avatarSeed = url.searchParams.get('avatarSeed') || request.headers.get('X-Avatar-Seed') || userId;

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
		};
		server.serializeAttachment(presence);

		// Check if this is the user's first connection (for join broadcast)
		// Use tags to query existing connections for this user
		const existingConnections = this.ctx.getWebSockets(`user:${userId}`);
		// Note: The new connection is already accepted, so it's included in the count
		const isNewUser = existingConnections.length === 1;

		// Send initial state to new connection
		this.sendInitialState(server);

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
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	private sendInitialState(ws: WebSocket): void {
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

		// Send recent chat history
		if (this.chatHistory.length > 0) {
			ws.send(
				JSON.stringify({
					type: 'chat',
					payload: {
						action: 'history',
						messages: this.chatHistory.slice(-20),
					},
					timestamp: Date.now(),
				}),
			);
		}

		// Send current rooms list
		const publicRooms = Array.from(this.activeRooms.values()).filter((r) => r.isPublic);
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
					this.sendRoomsList(ws);
					break;
				case 'room_created':
					if (data.room) {
						this.activeRooms.set(data.room.code, data.room);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'created', room: data.room },
							timestamp: Date.now(),
						});
					}
					break;
				case 'room_updated':
					if (data.room) {
						this.activeRooms.set(data.room.code, data.room);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'updated', room: data.room },
							timestamp: Date.now(),
						});
					}
					break;
				case 'room_closed':
					if (data.code) {
						this.activeRooms.delete(data.code);
						this.broadcast({
							type: 'room_update',
							payload: { action: 'closed', code: data.code },
							timestamp: Date.now(),
						});
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

		// Add to history (trim if too long)
		this.chatHistory.push(chatMessage);
		if (this.chatHistory.length > MAX_CHAT_HISTORY) {
			this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY);
		}

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

	private sendRoomsList(ws: WebSocket): void {
		// Get all public rooms (both waiting and playing)
		const publicRooms = Array.from(this.activeRooms.values())
			.filter((r) => r.isPublic)
			.sort((a, b) => {
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

	// =========================================================================
	// REST Endpoints
	// =========================================================================

	private getLobbyInfo(): Response {
		return Response.json({
			service: 'Game Lobby',
			onlineCount: this.getUniqueUserCount(),
			connectionCount: this.ctx.getWebSockets().length,
			roomCount: this.activeRooms.size,
			publicRoomCount: Array.from(this.activeRooms.values()).filter((r) => r.isPublic).length,
		});
	}

	private getPublicRooms(): Response {
		const rooms = Array.from(this.activeRooms.values())
			.filter((r) => r.isPublic)
			.sort((a, b) => b.createdAt - a.createdAt);

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
	// RPC Methods (called by GameRoom DOs)
	// =========================================================================

	/**
	 * Update room status in the directory.
	 * Called by GameRoom on: player join/leave, spectator join/leave,
	 * game start, round change, game end.
	 */
	updateRoomStatus(update: RoomStatusUpdate): void {
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
			createdAt: this.activeRooms.get(update.roomCode)?.createdAt ?? update.updatedAt,
			updatedAt: update.updatedAt,
		};

		// Handle finished rooms
		if (update.status === 'finished') {
			// Keep finished games briefly for "recent results"
			this.scheduleRoomRemoval(update.roomCode, 60_000);
		}

		this.activeRooms.set(update.roomCode, roomInfo);

		// Broadcast to lobby clients
		this.broadcast({
			type: 'room_update',
			payload: { action: 'updated', room: roomInfo },
			timestamp: Date.now(),
		});

		console.log(`[GlobalLobby] Room ${update.roomCode} updated: ${update.status}, ${update.playerCount} players, ${update.spectatorCount} spectators`);
	}

	/**
	 * Send a game highlight to lobby clients.
	 * Used for ticker events like Yahtzees, high scores, etc.
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
	removeRoom(roomCode: string): void {
		this.activeRooms.delete(roomCode);

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
		setTimeout(() => {
			const room = this.activeRooms.get(roomCode);
			if (room?.status === 'finished') {
				this.removeRoom(roomCode);
			}
		}, delayMs);
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
