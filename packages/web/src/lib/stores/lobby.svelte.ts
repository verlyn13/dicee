/**
 * Lobby State Store - Svelte 5 Runes
 *
 * Manages global lobby state:
 * - WebSocket connection to GlobalLobby DO
 * - Online presence
 * - Room browser
 * - Global chat
 * - Ticker events
 */
import { browser } from '$app/environment';

// Types
export interface ChatMessage {
	id: string;
	userId: string;
	username: string;
	content: string;
	timestamp: number;
	type: 'user' | 'system';
}

export interface RoomInfo {
	code: string;
	game: 'dicee';
	mode: 'classic' | 'blitz' | 'hardcore';
	host: string;
	playerCount: number;
	maxPlayers: number;
	isPublic: boolean;
	status: 'open' | 'playing' | 'full';
	createdAt: number;
}

export interface TickerEvent {
	id: string;
	type: 'join' | 'room_created' | 'game_won' | 'jackpot';
	message: string;
	timestamp: number;
}

export interface OnlineUser {
	userId: string;
	displayName: string;
	avatarSeed: string;
	/** Room code if user is currently in a room (null if just in lobby) */
	currentRoomCode: string | null;
}

/**
 * Pending invite received from another user.
 * Displayed in InvitePopup for accept/decline.
 */
export interface PendingInvite {
	inviteId: string;
	roomCode: string;
	hostUserId: string;
	hostDisplayName: string;
	hostAvatarSeed: string;
	game: 'dicee';
	playerCount: number;
	maxPlayers: number;
	expiresAt: number;
}

/**
 * Status of an active join request sent by this user.
 * Used to show pending/approved/declined UI in the lobby.
 */
export type JoinRequestStatus =
	| 'pending'
	| 'approved'
	| 'declined'
	| 'expired'
	| 'cancelled'
	| 'error';

/**
 * Active join request sent by this user.
 * Only one can be active at a time.
 */
export interface ActiveJoinRequest {
	requestId: string;
	roomCode: string;
	status: JoinRequestStatus;
	expiresAt: number;
	errorMessage?: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Reactive state with Svelte 5 runes
class LobbyState {
	// Connection
	connectionState = $state<ConnectionState>('disconnected');
	reconnectAttempts = $state(0);

	// Data
	onlineCount = $state(0);
	onlineUsers = $state<OnlineUser[]>([]);
	rooms = $state<RoomInfo[]>([]);
	messages = $state<ChatMessage[]>([]);
	ticker = $state<TickerEvent[]>([]);
	unreadCount = $state(0);

	// UI state
	activeTab = $state<'games' | 'chat'>('games');
	isCreateDrawerOpen = $state(false);
	showOnlineUsers = $state(false);

	// Invite system
	pendingInvites = $state<PendingInvite[]>([]);

	// Join request system (requester side)
	activeJoinRequest = $state<ActiveJoinRequest | null>(null);

	// Derived
	openRooms = $derived(this.rooms.filter((r) => r.status === 'open'));

	/** The current invite to display (first in queue, or null) */
	currentInvite = $derived(this.pendingInvites[0] ?? null);

	/** Whether there are any pending invites */
	hasInvites = $derived(this.pendingInvites.length > 0);
	playingRooms = $derived(this.rooms.filter((r) => r.status === 'playing'));

	/** Whether we have an active pending join request */
	hasActiveJoinRequest = $derived(
		this.activeJoinRequest !== null && this.activeJoinRequest.status === 'pending',
	);

	/** Seconds remaining until join request expires */
	joinRequestSecondsRemaining = $derived.by(() => {
		if (!this.activeJoinRequest || this.activeJoinRequest.status !== 'pending') return null;
		const remaining = Math.max(
			0,
			Math.ceil((this.activeJoinRequest.expiresAt - Date.now()) / 1000),
		);
		return remaining;
	});

	// Show online count with appropriate label
	onlineDisplay = $derived(
		this.onlineCount === 0
			? 'Connecting...'
			: this.onlineCount === 1
				? '1 online (you)'
				: `${this.onlineCount} online`,
	);

	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private connectPromise: Promise<void> | null = null;
	private intentionalDisconnect = false;
	private readonly MAX_MESSAGES = 100;
	private readonly MAX_TICKER = 10;
	private readonly RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
	private readonly PING_INTERVAL = 30000; // 30 seconds

	/**
	 * Connect to the lobby WebSocket.
	 * Idempotent - returns existing promise if already connecting/connected.
	 */
	connect(): Promise<void> {
		// Reset intentional flag on new connect attempt
		this.intentionalDisconnect = false;

		// Return existing promise if already connecting
		if (this.connectPromise) return this.connectPromise;

		// Already connected - return resolved promise
		if (this.ws?.readyState === WebSocket.OPEN) {
			return Promise.resolve();
		}

		// Create new connection
		this.connectPromise = this.connectToServer();
		return this.connectPromise;
	}

	/**
	 * Internal connection method.
	 */
	private connectToServer(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!browser) {
				this.connectPromise = null;
				reject(new Error('Not in browser'));
				return;
			}

			this.connectionState = 'connecting';

			const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			this.ws = new WebSocket(`${protocol}//${location.host}/ws/lobby`);

			this.ws.onopen = () => {
				this.connectionState = 'connected';
				this.reconnectAttempts = 0;
				this.clearReconnectTimer();
				this.startPingInterval();
				resolve();
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.handleMessage(data);
				} catch (e) {
					console.error('[lobby] Failed to parse message:', e);
				}
			};

			this.ws.onclose = (event) => {
				this.connectionState = 'disconnected';
				this.connectPromise = null;
				this.stopPingInterval();
				if (!event.wasClean && !this.intentionalDisconnect) {
					this.scheduleReconnect();
				}
			};

			this.ws.onerror = (error) => {
				// Error will trigger close, which handles reconnect
				// Only reject if this is the initial connection attempt
				if (this.connectionState === 'connecting') {
					reject(error);
				}
			};
		});
	}

	/**
	 * Disconnect from the lobby WebSocket.
	 * Sets intentionalDisconnect to prevent auto-reconnect (e.g., on logout).
	 */
	disconnect() {
		this.intentionalDisconnect = true;
		this.clearReconnectTimer();
		this.stopPingInterval();
		this.ws?.close(1000, 'User disconnect');
		this.ws = null;
		this.connectionState = 'disconnected';
		this.connectPromise = null;
	}

	private handleMessage(data: { type: string; payload: unknown; timestamp?: number }) {
		console.log('[lobby] handleMessage:', data.type, data);
		switch (data.type) {
			case 'chat': {
				// Handle both history and single message formats from DO
				const chatPayload = data.payload as {
					action: 'history' | 'message';
					messages?: Array<{
						id: string;
						userId: string;
						displayName: string;
						content: string;
						timestamp: number;
					}>;
					message?: {
						id: string;
						userId: string;
						displayName: string;
						content: string;
						timestamp: number;
					};
				};

				if (chatPayload.action === 'history' && chatPayload.messages) {
					// Initial history load - map displayName to username
					const mapped = chatPayload.messages.map((m) => ({
						id: m.id,
						userId: m.userId,
						username: m.displayName,
						content: m.content,
						timestamp: m.timestamp,
						type: 'user' as const,
					}));
					this.messages = mapped.slice(-this.MAX_MESSAGES);
				} else if (chatPayload.action === 'message' && chatPayload.message) {
					// New message - map displayName to username
					const msg: ChatMessage = {
						id: chatPayload.message.id,
						userId: chatPayload.message.userId,
						username: chatPayload.message.displayName,
						content: chatPayload.message.content,
						timestamp: chatPayload.message.timestamp,
						type: 'user',
					};
					this.messages = [...this.messages.slice(-(this.MAX_MESSAGES - 1)), msg];
					if (this.activeTab !== 'chat') {
						this.unreadCount++;
					}
				}
				break;
			}

			case 'presence': {
				const p = data.payload as { action: string; onlineCount: number; displayName?: string };
				this.onlineCount = p.onlineCount;

				// Add to ticker
				if (p.action === 'join' && p.displayName) {
					this.addTickerEvent({
						type: 'join',
						message: `${p.displayName} joined`,
					});
				}
				break;
			}

			case 'room_update': {
				const update = data.payload as { action: string; room?: RoomInfo; code?: string };
				if (update.action === 'created' && update.room) {
					this.rooms = [update.room, ...this.rooms];
					this.addTickerEvent({
						type: 'room_created',
						message: `Room #${update.room.code} created`,
					});
				} else if (update.action === 'closed' && update.code) {
					this.rooms = this.rooms.filter((r) => r.code !== update.code);
				} else if (update.action === 'updated' && update.room) {
					const updatedRoom = update.room;
					this.rooms = this.rooms.map((r) => (r.code === updatedRoom.code ? updatedRoom : r));
				}
				break;
			}

			case 'rooms': {
				// Initial room list
				const roomList = data.payload as RoomInfo[];
				this.rooms = roomList;
				break;
			}

			case 'history': {
				// Initial chat history
				const history = data.payload as ChatMessage[];
				this.messages = history.slice(-this.MAX_MESSAGES);
				break;
			}

			case 'pong':
				// Heartbeat acknowledged
				break;

			case 'online_users': {
				console.log('[lobby] Received online_users:', data.payload);
				const usersPayload = data.payload as { users: OnlineUser[]; count: number };
				this.onlineUsers = usersPayload.users;
				console.log('[lobby] Set onlineUsers to:', this.onlineUsers);
				break;
			}

			case 'invite_received': {
				const invitePayload = data.payload as {
					inviteId: string;
					roomCode: string;
					hostUserId: string;
					hostDisplayName: string;
					hostAvatarSeed: string;
					game: 'dicee';
					playerCount: number;
					maxPlayers: number;
					expiresAt: number;
				};
				const invite: PendingInvite = {
					inviteId: invitePayload.inviteId,
					roomCode: invitePayload.roomCode,
					hostUserId: invitePayload.hostUserId,
					hostDisplayName: invitePayload.hostDisplayName,
					hostAvatarSeed: invitePayload.hostAvatarSeed,
					game: invitePayload.game,
					playerCount: invitePayload.playerCount,
					maxPlayers: invitePayload.maxPlayers,
					expiresAt: invitePayload.expiresAt,
				};
				// Add to beginning of queue
				this.pendingInvites = [invite, ...this.pendingInvites];

				// Add to ticker
				this.addTickerEvent({
					type: 'join',
					message: `${invite.hostDisplayName} invited you to play`,
				});
				break;
			}

			case 'invite_cancelled': {
				const cancelPayload = data.payload as {
					inviteId: string;
					roomCode: string;
					reason: string;
				};
				// Remove the invite from pending list
				this.pendingInvites = this.pendingInvites.filter(
					(inv) => inv.inviteId !== cancelPayload.inviteId,
				);
				break;
			}

			// Join request responses (requester side) - delegated to reduce complexity
			case 'join_request_sent':
			case 'join_request_error':
			case 'join_approved':
			case 'join_declined':
			case 'join_request_expired':
			case 'join_request_cancelled':
				this.handleJoinRequestMessage(data.type, data.payload);
				break;
		}
	}

	/**
	 * Handle join request-related messages.
	 * Extracted from handleMessage to reduce cognitive complexity.
	 */
	private handleJoinRequestMessage(type: string, payload: unknown) {
		switch (type) {
			case 'join_request_sent': {
				const sentPayload = payload as {
					requestId: string;
					roomCode: string;
					expiresAt: number;
				};
				this.activeJoinRequest = {
					requestId: sentPayload.requestId,
					roomCode: sentPayload.roomCode,
					status: 'pending',
					expiresAt: sentPayload.expiresAt,
				};
				console.log('[lobby] Join request sent:', this.activeJoinRequest);
				break;
			}

			case 'join_request_error': {
				const errorPayload = payload as {
					code: string;
					message: string;
				};
				// If we have an active request, mark it as error
				if (this.activeJoinRequest) {
					this.activeJoinRequest = {
						...this.activeJoinRequest,
						status: 'error',
						errorMessage: errorPayload.message,
					};
				} else {
					// No active request, create a temporary error state
					this.activeJoinRequest = {
						requestId: '',
						roomCode: '',
						status: 'error',
						expiresAt: 0,
						errorMessage: errorPayload.message,
					};
				}
				// Auto-clear error after 3 seconds
				setTimeout(() => {
					if (this.activeJoinRequest?.status === 'error') {
						this.activeJoinRequest = null;
					}
				}, 3000);
				console.log('[lobby] Join request error:', errorPayload);
				break;
			}

			case 'join_approved': {
				const approvedPayload = payload as {
					requestId: string;
					roomCode: string;
				};
				if (this.activeJoinRequest?.requestId === approvedPayload.requestId) {
					this.activeJoinRequest = {
						...this.activeJoinRequest,
						status: 'approved',
					};
					console.log('[lobby] Join request approved:', approvedPayload.roomCode);
					// Note: Navigation to room should be handled by the UI component
				}
				break;
			}

			case 'join_declined': {
				const declinedPayload = payload as {
					requestId: string;
					reason?: string;
				};
				if (this.activeJoinRequest?.requestId === declinedPayload.requestId) {
					this.activeJoinRequest = {
						...this.activeJoinRequest,
						status: 'declined',
						errorMessage: declinedPayload.reason ?? 'Host declined your request',
					};
					// Auto-clear after 3 seconds
					setTimeout(() => {
						if (this.activeJoinRequest?.status === 'declined') {
							this.activeJoinRequest = null;
						}
					}, 3000);
					console.log('[lobby] Join request declined:', declinedPayload);
				}
				break;
			}

			case 'join_request_expired': {
				const expiredPayload = payload as {
					requestId: string;
				};
				if (this.activeJoinRequest?.requestId === expiredPayload.requestId) {
					this.activeJoinRequest = {
						...this.activeJoinRequest,
						status: 'expired',
					};
					// Auto-clear after 3 seconds
					setTimeout(() => {
						if (this.activeJoinRequest?.status === 'expired') {
							this.activeJoinRequest = null;
						}
					}, 3000);
					console.log('[lobby] Join request expired');
				}
				break;
			}

			case 'join_request_cancelled': {
				const cancelledPayload = payload as {
					requestId: string;
				};
				if (this.activeJoinRequest?.requestId === cancelledPayload.requestId) {
					this.activeJoinRequest = null;
					console.log('[lobby] Join request cancelled');
				}
				break;
			}
		}
	}

	private addTickerEvent(event: Omit<TickerEvent, 'id' | 'timestamp'>) {
		const full: TickerEvent = {
			...event,
			id: crypto.randomUUID(),
			timestamp: Date.now(),
		};
		this.ticker = [full, ...this.ticker.slice(0, this.MAX_TICKER - 1)];
	}

	private scheduleReconnect() {
		// Don't reconnect after intentional disconnect (logout)
		if (this.intentionalDisconnect) return;
		if (this.reconnectTimer) return;

		const delay =
			this.RECONNECT_DELAYS[Math.min(this.reconnectAttempts, this.RECONNECT_DELAYS.length - 1)];

		this.connectionState = 'reconnecting';
		this.reconnectAttempts++;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}

	private clearReconnectTimer() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private startPingInterval() {
		this.stopPingInterval();
		this.pingInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: 'ping' }));
			}
		}, this.PING_INTERVAL);
	}

	private stopPingInterval() {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	// Actions
	sendChat(content: string) {
		if (!content.trim() || this.ws?.readyState !== WebSocket.OPEN) return;

		// Send to server - no optimistic update to avoid duplicate messages
		// Server will broadcast back to all users including sender
		this.ws.send(JSON.stringify({ type: 'chat', content: content.trim() }));
	}

	markChatRead() {
		this.unreadCount = 0;
	}

	setActiveTab(tab: 'games' | 'chat') {
		this.activeTab = tab;
		if (tab === 'chat') {
			this.markChatRead();
		}
	}

	requestRooms() {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'get_rooms' }));
		}
	}

	/**
	 * Request list of online users from server.
	 * Called when user clicks on the online indicator.
	 */
	requestOnlineUsers() {
		console.log('[lobby] requestOnlineUsers called, ws state:', this.ws?.readyState);
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('[lobby] Sending get_online_users');
			this.ws.send(JSON.stringify({ type: 'get_online_users' }));
		} else {
			console.warn('[lobby] Cannot request online users - WebSocket not open');
		}
	}

	/**
	 * Toggle the online users display panel.
	 * Requests fresh data when opening.
	 */
	toggleOnlineUsers() {
		this.showOnlineUsers = !this.showOnlineUsers;
		if (this.showOnlineUsers) {
			this.requestOnlineUsers();
		}
	}

	/**
	 * Close the online users display panel.
	 */
	closeOnlineUsers() {
		this.showOnlineUsers = false;
	}

	// =========================================================================
	// Invite Actions
	// =========================================================================

	/**
	 * Respond to an invite (accept or decline).
	 * If accepting, the user will navigate to the room after this.
	 */
	respondToInvite(inviteId: string, roomCode: string, action: 'accept' | 'decline') {
		// Remove from local state immediately
		this.pendingInvites = this.pendingInvites.filter((inv) => inv.inviteId !== inviteId);

		// Send response to server via WebSocket
		// Note: The invite response goes through GlobalLobby which forwards to GameRoom
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: 'invite_response',
					payload: {
						inviteId,
						roomCode,
						action,
					},
				}),
			);
		}
	}

	/**
	 * Dismiss an invite (convenience method that declines).
	 */
	dismissInvite(inviteId: string) {
		const invite = this.pendingInvites.find((inv) => inv.inviteId === inviteId);
		if (invite) {
			this.respondToInvite(inviteId, invite.roomCode, 'decline');
		}
	}

	/**
	 * Clear all pending invites (e.g., when navigating away).
	 */
	clearInvites() {
		// Decline all pending invites
		for (const invite of this.pendingInvites) {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(
					JSON.stringify({
						type: 'invite_response',
						payload: {
							inviteId: invite.inviteId,
							roomCode: invite.roomCode,
							action: 'decline',
						},
					}),
				);
			}
		}
		this.pendingInvites = [];
	}

	// =========================================================================
	// Join Request Actions (Requester Side)
	// =========================================================================

	/**
	 * Send a join request to a room.
	 * Can only have one active request at a time.
	 *
	 * @param roomCode - The room code to request to join
	 */
	sendJoinRequest(roomCode: string) {
		// Can't send if already have an active pending request
		if (this.hasActiveJoinRequest) {
			console.warn('[lobby] Already have an active join request');
			return;
		}

		if (this.ws?.readyState !== WebSocket.OPEN) {
			console.warn('[lobby] Cannot send join request - WebSocket not open');
			return;
		}

		console.log('[lobby] Sending join request to room:', roomCode);
		this.ws.send(
			JSON.stringify({
				type: 'request_join',
				roomCode: roomCode.toUpperCase(),
			}),
		);
	}

	/**
	 * Cancel the active join request.
	 */
	cancelJoinRequest() {
		if (!this.activeJoinRequest || this.activeJoinRequest.status !== 'pending') {
			console.warn('[lobby] No active pending join request to cancel');
			return;
		}

		if (this.ws?.readyState !== WebSocket.OPEN) {
			// Just clear locally if can't reach server
			this.activeJoinRequest = null;
			return;
		}

		console.log('[lobby] Cancelling join request:', this.activeJoinRequest.requestId);
		this.ws.send(
			JSON.stringify({
				type: 'cancel_join_request',
				requestId: this.activeJoinRequest.requestId,
				roomCode: this.activeJoinRequest.roomCode,
			}),
		);

		// Clear optimistically (server will confirm)
		this.activeJoinRequest = { ...this.activeJoinRequest, status: 'cancelled' };
	}

	/**
	 * Clear the join request state (e.g., after navigation).
	 */
	clearJoinRequest() {
		// If pending, cancel it on the server
		if (this.activeJoinRequest?.status === 'pending') {
			this.cancelJoinRequest();
		} else {
			this.activeJoinRequest = null;
		}
	}

	/**
	 * Get the active join request for a specific room.
	 * Returns null if no request or request is for a different room.
	 */
	getJoinRequestForRoom(roomCode: string): ActiveJoinRequest | null {
		if (this.activeJoinRequest?.roomCode?.toUpperCase() === roomCode.toUpperCase()) {
			return this.activeJoinRequest;
		}
		return null;
	}
}

export const lobby = new LobbyState();
