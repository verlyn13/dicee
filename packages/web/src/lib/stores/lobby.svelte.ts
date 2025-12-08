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

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Reactive state with Svelte 5 runes
class LobbyState {
	// Connection
	connectionState = $state<ConnectionState>('disconnected');
	reconnectAttempts = $state(0);

	// Data
	onlineCount = $state(0);
	rooms = $state<RoomInfo[]>([]);
	messages = $state<ChatMessage[]>([]);
	ticker = $state<TickerEvent[]>([]);
	unreadCount = $state(0);

	// UI state
	activeTab = $state<'games' | 'chat'>('games');
	isCreateDrawerOpen = $state(false);

	// Derived
	openRooms = $derived(this.rooms.filter((r) => r.status === 'open'));
	playingRooms = $derived(this.rooms.filter((r) => r.status === 'playing'));

	// Show online count only if meaningful
	onlineDisplay = $derived(this.onlineCount >= 5 ? `${this.onlineCount} online` : 'Lobby Open');

	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private readonly MAX_MESSAGES = 100;
	private readonly MAX_TICKER = 10;
	private readonly RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
	private readonly PING_INTERVAL = 30000; // 30 seconds

	connect() {
		if (!browser || this.ws?.readyState === WebSocket.OPEN) return;

		this.connectionState = 'connecting';

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		this.ws = new WebSocket(`${protocol}//${location.host}/ws/lobby`);

		this.ws.onopen = () => {
			this.connectionState = 'connected';
			this.reconnectAttempts = 0;
			this.clearReconnectTimer();
			this.startPingInterval();
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
			this.stopPingInterval();
			if (!event.wasClean) {
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			// Error will trigger close, which handles reconnect
		};
	}

	disconnect() {
		this.clearReconnectTimer();
		this.stopPingInterval();
		this.ws?.close(1000, 'User disconnect');
		this.ws = null;
		this.connectionState = 'disconnected';
	}

	private handleMessage(data: { type: string; payload: unknown; timestamp?: number }) {
		switch (data.type) {
			case 'chat': {
				const msg = data.payload as ChatMessage;
				this.messages = [...this.messages.slice(-(this.MAX_MESSAGES - 1)), msg];
				if (this.activeTab !== 'chat') {
					this.unreadCount++;
				}
				break;
			}

			case 'presence': {
				const p = data.payload as { action: string; onlineCount: number; username?: string };
				this.onlineCount = p.onlineCount;

				// Add to ticker
				if (p.action === 'join' && p.username) {
					this.addTickerEvent({
						type: 'join',
						message: `${p.username} joined`,
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

		// Optimistic update
		const optimisticMsg: ChatMessage = {
			id: `pending-${Date.now()}`,
			userId: 'self',
			username: 'you',
			content: content.trim(),
			timestamp: Date.now(),
			type: 'user',
		};
		this.messages = [...this.messages.slice(-(this.MAX_MESSAGES - 1)), optimisticMsg];

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
}

export const lobby = new LobbyState();
