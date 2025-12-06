/**
 * Room Service
 *
 * Manages WebSocket connection to PartyKit server.
 * Uses PartySocket for automatic reconnection and connection handling.
 */

import PartySocket from 'partysocket';
import { env } from '$env/dynamic/public';
import type { Command, GameRoom, RoomCode, ServerEvent } from '$lib/types/multiplayer';
import { parseServerEvent } from '$lib/types/multiplayer.schema';

/** PartyKit host with fallback for local development */
const PARTYKIT_HOST = env.PUBLIC_PARTYKIT_HOST ?? 'localhost:1999';

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
 * Room Service - manages connection to PartyKit server
 */
class RoomService {
	/** PartySocket instance */
	private socket: PartySocket | null = null;

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
			// Create PartySocket connection
			this.socket = new PartySocket({
				host: PARTYKIT_HOST,
				room: roomCode,
				query: {
					token: accessToken,
				},
			});

			// Set up event handlers
			this.socket.addEventListener('open', this.handleOpen.bind(this));
			this.socket.addEventListener('message', this.handleMessage.bind(this));
			this.socket.addEventListener('close', this.handleClose.bind(this));
			this.socket.addEventListener('error', this.handleError.bind(this));
		} catch (error) {
			this._error = error instanceof Error ? error.message : 'Connection failed';
			this.setStatus('error');
			throw error;
		}
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

		// Wait for room.state event to confirm room creation
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.disconnect();
				reject(new Error('Room creation timed out'));
			}, 10000);

			const handler = (event: ServerEvent) => {
				if (event.type === 'room.state') {
					clearTimeout(timeout);
					this.removeEventHandler(handler);
					resolve(roomCode);
				} else if (event.type === 'error') {
					clearTimeout(timeout);
					this.removeEventHandler(handler);
					reject(new Error(event.message));
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
		this.send({ type: 'game.start' });
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
			const result = parseServerEvent(raw);

			if (!result.success) {
				console.warn('[RoomService] Invalid server event:', result.error);
				return;
			}

			const serverEvent = result.data as ServerEvent;

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

	private handleClose(event: CloseEvent): void {
		console.log('[RoomService] Disconnected:', event.code, event.reason);

		// PartySocket will auto-reconnect, but we track the status
		if (this._status === 'connected') {
			this.setStatus('connecting'); // Reconnecting
		}
	}

	private handleError(error: Event): void {
		console.error('[RoomService] Connection error:', error);
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
