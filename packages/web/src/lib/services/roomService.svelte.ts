/**
 * Room Service
 *
 * Manages WebSocket connection to multiplayer server (Cloudflare Durable Objects).
 * Handles room creation, joining, game commands, and chat.
 */

import ReconnectingWebSocket from 'reconnecting-websocket';
import { env } from '$env/dynamic/public';
import type {
	ChatCommand_Union,
	Command,
	GameRoom,
	QuickChatKey,
	ReactionEmoji,
	RoomCode,
	ServerEvent,
} from '$lib/types/multiplayer';
import { parseServerEvent } from '$lib/types/multiplayer.schema';

// =============================================================================
// Configuration
// =============================================================================

/** Durable Objects worker host */
const WORKER_HOST = env.PUBLIC_WORKER_HOST ?? 'localhost:8787';

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomServiceState {
	/** Current connection status */
	status: ConnectionStatus;
	/** Current room data */
	room: GameRoom | null;
	/** Last error message */
	error: string | null;
	/** Room code we're connected to */
	roomCode: RoomCode | null;
}

export type ServerEventHandler = (event: ServerEvent) => void;

// =============================================================================
// Room Service Class
// =============================================================================

/**
 * Room Service - manages connection to Cloudflare Durable Objects multiplayer server
 */
class RoomService {
	/** WebSocket instance */
	private socket: ReconnectingWebSocket | null = null;

	/** Event handlers */
	private eventHandlers: Set<ServerEventHandler> = new Set();

	/** Connection status listeners */
	private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

	/** Current state */
	private _status: ConnectionStatus = 'disconnected';
	private _room: GameRoom | null = null;
	private _error: string | null = null;
	private _roomCode: RoomCode | null = null;

	// =========================================================================
	// Public Getters
	// =========================================================================

	get status(): ConnectionStatus {
		return this._status;
	}

	get room(): GameRoom | null {
		return this._room;
	}

	get error(): string | null {
		return this._error;
	}

	get roomCode(): RoomCode | null {
		return this._roomCode;
	}

	get state(): RoomServiceState {
		return {
			status: this._status,
			room: this._room,
			error: this._error,
			roomCode: this._roomCode,
		};
	}

	get isConnected(): boolean {
		return this._status === 'connected';
	}

	// =========================================================================
	// Connection Management
	// =========================================================================

	/**
	 * Connect to a room
	 *
	 * @param roomCode - 6-character room code
	 * @param accessToken - Supabase access token for authentication
	 */
	async connect(roomCode: RoomCode, accessToken: string): Promise<void> {
		// Disconnect existing connection
		if (this.socket) {
			this.disconnect();
		}

		this._roomCode = roomCode;
		this.setStatus('connecting');
		this._error = null;

		try {
			this.connectToServer(roomCode, accessToken);
		} catch (error) {
			this._error = error instanceof Error ? error.message : 'Connection failed';
			this.setStatus('error');
			throw error;
		}
	}

	/**
	 * Connect to Durable Objects multiplayer server
	 */
	private connectToServer(roomCode: RoomCode, accessToken: string): void {
		console.log(`[RoomService] Connecting to room: ${roomCode}`);

		// Determine protocol based on host
		const isLocalhost = WORKER_HOST.includes('localhost') || WORKER_HOST.includes('127.0.0.1');
		const protocol = isLocalhost ? 'ws' : 'wss';
		const wsUrl = `${protocol}://${WORKER_HOST}/room/${roomCode}?token=${encodeURIComponent(accessToken)}`;

		const socket = new ReconnectingWebSocket(wsUrl, [], {
			maxRetries: 10,
			reconnectionDelayGrowFactor: 1.5,
			maxReconnectionDelay: 30000,
			minReconnectionDelay: 1000,
		});

		this.socket = socket;
		this.setupEventHandlers(socket);
	}

	/**
	 * Set up event handlers for WebSocket
	 */
	private setupEventHandlers(socket: ReconnectingWebSocket): void {
		socket.addEventListener('open', () => this.handleOpen());
		socket.addEventListener('message', (e) => this.handleMessage(e as MessageEvent));
		socket.addEventListener('close', (e) => this.handleClose(e as CloseEvent));
		socket.addEventListener('error', () => this.handleError());
	}

	/**
	 * Disconnect from current room
	 */
	disconnect(): void {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
		this._room = null;
		this._roomCode = null;
		this.setStatus('disconnected');
	}

	/**
	 * Create a new room and connect to it
	 *
	 * @param accessToken - Supabase access token
	 * @returns Promise that resolves with room code when created
	 */
	async createRoom(accessToken: string): Promise<RoomCode> {
		// Generate room code client-side
		const { generateRoomCode } = await import('$lib/types/multiplayer.schema');
		const roomCode = generateRoomCode();

		// Connect to the room (first player becomes host)
		await this.connect(roomCode, accessToken);

		// Wait for connection confirmation
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.disconnect();
				reject(new Error('Room creation timed out'));
			}, 10000);

			const handler = (event: ServerEvent) => {
				// Handle both PartyKit format (room.state) and DO format (CONNECTED)
				// Use string comparison to handle both event type systems
				const eventType = event.type as string;
				if (eventType === 'room.state' || eventType === 'CONNECTED') {
					clearTimeout(timeout);
					this.removeEventHandler(handler);
					resolve(roomCode);
				} else if (eventType === 'error' || eventType === 'ERROR') {
					clearTimeout(timeout);
					this.removeEventHandler(handler);
					const errorMsg =
						'message' in event ? (event as { message: string }).message : 'Unknown error';
					reject(new Error(errorMsg));
				}
			};

			this.addEventHandler(handler);
		});
	}

	// =========================================================================
	// Command Sending
	// =========================================================================

	/**
	 * Send a command to the server
	 */
	send(command: Command): void {
		if (!this.socket || this._status !== 'connected') {
			throw new Error('Not connected to room');
		}
		this.socket.send(JSON.stringify(command));
	}

	/**
	 * Rejoin/update presence in room
	 * Note: Display name is set via JWT claims on connection
	 */
	sendRejoin(): void {
		this.send({
			type: 'room.join',
			roomCode: this._roomCode ?? '',
		});
	}

	/**
	 * Send leave room command
	 */
	sendLeave(): void {
		this.send({ type: 'room.leave' });
	}

	/**
	 * Send start game command (host only)
	 */
	sendStartGame(): void {
		this.send({ type: 'START_GAME' } as unknown as Command);
	}

	/**
	 * Send roll dice command
	 */
	sendRollDice(kept: [boolean, boolean, boolean, boolean, boolean]): void {
		this.send({ type: 'dice.roll', kept });
	}

	/**
	 * Send keep dice command
	 */
	sendKeepDice(indices: number[]): void {
		this.send({ type: 'dice.keep', indices });
	}

	/**
	 * Send score category command
	 */
	sendScoreCategory(category: string): void {
		this.send({ type: 'category.score', category });
	}

	/**
	 * Send rematch command (host only)
	 */
	sendRematch(): void {
		this.send({ type: 'game.rematch' });
	}

	// =========================================================================
	// Chat Commands
	// =========================================================================

	/**
	 * Send a chat command (type-safe internal helper)
	 */
	private sendChat(command: ChatCommand_Union): void {
		if (!this.socket || this._status !== 'connected') {
			throw new Error('Not connected to room');
		}
		this.socket.send(JSON.stringify(command));
	}

	/**
	 * Send a text chat message
	 */
	sendChatMessage(content: string): void {
		this.sendChat({ type: 'CHAT', payload: { content } });
	}

	/**
	 * Send a quick chat preset
	 */
	sendQuickChat(key: QuickChatKey): void {
		this.sendChat({ type: 'QUICK_CHAT', payload: { key } });
	}

	/**
	 * Send a reaction to a message
	 */
	sendReaction(messageId: string, emoji: ReactionEmoji, action: 'add' | 'remove'): void {
		this.sendChat({ type: 'REACTION', payload: { messageId, emoji, action } });
	}

	/**
	 * Send typing start indicator
	 */
	sendTypingStart(): void {
		this.sendChat({ type: 'TYPING_START' });
	}

	/**
	 * Send typing stop indicator
	 */
	sendTypingStop(): void {
		this.sendChat({ type: 'TYPING_STOP' });
	}

	// =========================================================================
	// Event Handling
	// =========================================================================

	/**
	 * Add a server event handler
	 */
	addEventHandler(handler: ServerEventHandler): void {
		this.eventHandlers.add(handler);
	}

	/**
	 * Remove a server event handler
	 */
	removeEventHandler(handler: ServerEventHandler): void {
		this.eventHandlers.delete(handler);
	}

	/**
	 * Add a connection status listener
	 */
	addStatusListener(listener: (status: ConnectionStatus) => void): void {
		this.statusListeners.add(listener);
	}

	/**
	 * Remove a connection status listener
	 */
	removeStatusListener(listener: (status: ConnectionStatus) => void): void {
		this.statusListeners.delete(listener);
	}

	// =========================================================================
	// Internal Event Handlers
	// =========================================================================

	private handleOpen(): void {
		console.log('[RoomService] Connected to room:', this._roomCode);
		this.setStatus('connected');
		this._error = null;
	}

	private handleMessage(event: MessageEvent): void {
		try {
			const raw = JSON.parse(event.data);

			// Handle both PartyKit and Durable Objects message formats
			const serverEvent = this.normalizeServerEvent(raw);

			if (!serverEvent) {
				console.warn('[RoomService] Could not normalize server event:', raw);
				return;
			}

			// Update local room state
			this.processEvent(serverEvent);

			// Notify handlers
			for (const handler of this.eventHandlers) {
				try {
					handler(serverEvent);
				} catch (error) {
					console.error('[RoomService] Event handler error:', error);
				}
			}
		} catch (error) {
			console.error('[RoomService] Failed to parse message:', error);
		}
	}

	/**
	 * Normalize events from different backends to a common format
	 */
	private normalizeServerEvent(raw: Record<string, unknown>): ServerEvent | null {
		// Try standard parsing first (PartyKit format)
		const result = parseServerEvent(raw);
		if (result.success) {
			return result.data as ServerEvent;
		}

		// Handle Durable Objects format
		const type = raw.type as string;

		switch (type) {
			case 'CONNECTED':
				// Convert DO CONNECTED to room.state format
				return {
					type: 'room.state',
					room: this.convertDOPayloadToRoom(raw.payload as Record<string, unknown>),
				} as ServerEvent;

			case 'PLAYER_JOINED':
				return {
					type: 'player.joined',
					player: this.convertDOPlayer(raw.payload as Record<string, unknown>),
				} as ServerEvent;

			case 'PLAYER_LEFT':
				return {
					type: 'player.left',
					playerId: (raw.payload as Record<string, unknown>)?.userId as string,
				} as ServerEvent;

			case 'GAME_STARTING':
				return { type: 'game.starting' } as ServerEvent;

			case 'GAME_STARTED': {
				const payload = raw.payload as Record<string, unknown>;
				return {
					type: 'game.started',
					playerOrder: (payload?.playerOrder as string[]) ?? [],
					currentPlayerId: (payload?.currentPlayerId as string) ?? '',
					turnNumber: 1,
					timestamp: new Date().toISOString(),
				} as unknown as ServerEvent;
			}

			case 'ERROR':
				return {
					type: 'error',
					code: (raw.payload as Record<string, unknown>)?.code as string,
					message: (raw.payload as Record<string, unknown>)?.message as string,
				} as ServerEvent;

			case 'PONG':
				// Ignore pong messages
				return null;

			// Chat events - pass through
			case 'CHAT_MESSAGE':
			case 'CHAT_HISTORY':
			case 'REACTION_UPDATE':
			case 'TYPING_UPDATE':
			case 'CHAT_ERROR':
				return raw as unknown as ServerEvent;

			default:
				console.warn('[RoomService] Unknown message type:', type);
				return null;
		}
	}

	/**
	 * Convert Durable Objects CONNECTED payload to GameRoom format
	 */
	private convertDOPayloadToRoom(payload: Record<string, unknown>): GameRoom {
		const players = (payload.players as Array<Record<string, unknown>>) ?? [];

		// Map DO room status to our RoomState type
		const rawStatus = (payload.roomStatus as string) ?? 'waiting';
		const validStates = ['waiting', 'starting', 'playing', 'completed', 'abandoned'] as const;
		const state = validStates.includes(rawStatus as (typeof validStates)[number])
			? (rawStatus as (typeof validStates)[number])
			: 'waiting';

		return {
			code: ((payload.roomCode as string) ??
				this._roomCode ??
				'UNKNWN') as import('$lib/types/multiplayer').RoomCode,
			hostId: (players.find((p) => p.isHost)?.userId as string) ?? '',
			state,
			config: {
				isPublic: false,
				allowSpectators: false,
				turnTimeoutSeconds: 60,
				maxPlayers: 4,
			},
			players: players.map((p) => this.convertDOPlayer(p)),
			createdAt: new Date().toISOString(),
			startedAt: state === 'playing' ? new Date().toISOString() : null,
		};
	}

	/**
	 * Convert Durable Objects player format to RoomPlayer format
	 */
	private convertDOPlayer(
		payload: Record<string, unknown>,
	): import('$lib/types/multiplayer').RoomPlayer {
		return {
			id: (payload.userId as string) ?? '',
			displayName: (payload.displayName as string) ?? 'Player',
			avatarSeed: (payload.avatarSeed as string) ?? (payload.userId as string) ?? '',
			isHost: (payload.isHost as boolean) ?? false,
			isConnected: (payload.isConnected as boolean) ?? true,
			joinedAt: (payload.connectedAt as string) ?? new Date().toISOString(),
		};
	}

	private handleClose(event: CloseEvent): void {
		console.log('[RoomService] Disconnected:', event.code, event.reason);

		// ReconnectingWebSocket auto-reconnects
		if (this._status === 'connected') {
			this.setStatus('connecting'); // Reconnecting
		}
	}

	private handleError(): void {
		console.error('[RoomService] Connection error');
		this._error = 'Connection error';
		this.setStatus('error');
	}

	private setStatus(status: ConnectionStatus): void {
		this._status = status;
		for (const listener of this.statusListeners) {
			try {
				listener(status);
			} catch (error) {
				console.error('[RoomService] Status listener error:', error);
			}
		}
	}

	private processEvent(event: ServerEvent): void {
		switch (event.type) {
			case 'room.state':
				this._room = event.room;
				break;

			case 'player.joined':
				if (this._room) {
					// Check if player already exists (shouldn't happen but be safe)
					const existing = this._room.players.find((p) => p.id === event.player.id);
					if (!existing) {
						this._room = {
							...this._room,
							players: [...this._room.players, event.player],
						};
					}
				}
				break;

			case 'player.left':
				if (this._room) {
					this._room = {
						...this._room,
						players: this._room.players.filter((p) => p.id !== event.playerId),
					};
				}
				break;

			case 'player.connection':
				if (this._room) {
					this._room = {
						...this._room,
						players: this._room.players.map((p) =>
							p.id === event.playerId ? { ...p, isConnected: event.isConnected } : p,
						),
					};
				}
				break;

			case 'game.starting':
				if (this._room) {
					this._room = { ...this._room, state: 'starting' };
				}
				break;

			case 'game.started':
				if (this._room) {
					this._room = { ...this._room, state: 'playing' };
				}
				break;

			case 'error':
				this._error = event.message;
				break;
		}
	}
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Singleton room service instance
 */
export const roomService = new RoomService();
