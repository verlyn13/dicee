/**
 * Chat Manager for Lobby Chat System
 *
 * Handles message history, rate limiting, reactions, and typing indicators.
 * All state persists via DurableObject storage.
 */

import { nanoid } from 'nanoid';
import {
	type ChatErrorCode,
	type ChatMessage,
	type ChatServerMessage,
	createEmptyReactions,
	type MessageReactions,
	QUICK_CHAT_MESSAGES,
	type QuickChatKey,
	RATE_LIMITS,
	type RateLimitState,
	REACTION_EMOJIS,
	type ReactionEmoji,
	type TypingState,
} from './types';

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEYS = {
	/** Chat message history array */
	MESSAGES: 'chat:messages',
	/** Per-user rate limit states */
	RATE_LIMITS: 'chat:rateLimits',
} as const;

// =============================================================================
// Chat Manager
// =============================================================================

/**
 * Manages lobby chat functionality within a GameRoom Durable Object.
 * Handles messages, reactions, typing indicators, and rate limiting.
 */
export class ChatManager {
	private ctx: DurableObjectState;

	/** In-memory cache of recent messages */
	private messages: ChatMessage[] = [];

	/** Per-user rate limit tracking */
	private rateLimits: Map<string, RateLimitState> = new Map();

	/** Active typing indicators */
	private typingUsers: Map<string, TypingState> = new Map();

	/** Whether state has been loaded from storage */
	private initialized = false;

	constructor(ctx: DurableObjectState) {
		this.ctx = ctx;
	}

	// ===========================================================================
	// Initialization
	// ===========================================================================

	/**
	 * Load chat state from storage (call once per DO wake)
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		const [messages, rateLimits] = await Promise.all([
			this.ctx.storage.get<ChatMessage[]>(STORAGE_KEYS.MESSAGES),
			this.ctx.storage.get<Record<string, RateLimitState>>(STORAGE_KEYS.RATE_LIMITS),
		]);

		this.messages = messages ?? [];
		this.rateLimits = new Map(Object.entries(rateLimits ?? {}));
		this.initialized = true;
	}

	// ===========================================================================
	// Message History
	// ===========================================================================

	/**
	 * Get recent chat history for a newly connected user
	 */
	getHistory(): ChatMessage[] {
		return [...this.messages];
	}

	/**
	 * Save a message to history and storage
	 */
	private async saveMessage(message: ChatMessage): Promise<void> {
		this.messages.push(message);

		// Trim to max history size
		if (this.messages.length > RATE_LIMITS.MESSAGE_HISTORY_SIZE) {
			this.messages = this.messages.slice(-RATE_LIMITS.MESSAGE_HISTORY_SIZE);
		}

		await this.ctx.storage.put(STORAGE_KEYS.MESSAGES, this.messages);
	}

	/**
	 * Find a message by ID
	 */
	private findMessage(messageId: string): ChatMessage | undefined {
		return this.messages.find((m) => m.id === messageId);
	}

	// ===========================================================================
	// Rate Limiting
	// ===========================================================================

	/**
	 * Get or create rate limit state for a user
	 */
	private getRateLimitState(userId: string): RateLimitState {
		let state = this.rateLimits.get(userId);
		if (!state) {
			state = {
				lastMessageAt: 0,
				lastTypingAt: 0,
				reactionCount: 0,
				reactionWindowStart: 0,
			};
			this.rateLimits.set(userId, state);
		}
		return state;
	}

	/**
	 * Persist rate limit state to storage
	 */
	private async persistRateLimits(): Promise<void> {
		const obj: Record<string, RateLimitState> = {};
		for (const [userId, state] of this.rateLimits) {
			obj[userId] = state;
		}
		await this.ctx.storage.put(STORAGE_KEYS.RATE_LIMITS, obj);
	}

	/**
	 * Check if user can send a message
	 * @returns error code if rate limited, null if allowed
	 */
	checkMessageRateLimit(userId: string): ChatErrorCode | null {
		const state = this.getRateLimitState(userId);
		const now = Date.now();

		if (now - state.lastMessageAt < RATE_LIMITS.MESSAGE_INTERVAL_MS) {
			return 'RATE_LIMITED';
		}

		return null;
	}

	/**
	 * Check if user can send a typing indicator
	 * @returns true if allowed
	 */
	checkTypingRateLimit(userId: string): boolean {
		const state = this.getRateLimitState(userId);
		const now = Date.now();

		return now - state.lastTypingAt >= RATE_LIMITS.TYPING_INTERVAL_MS;
	}

	/**
	 * Check if user can add a reaction
	 * @returns error code if rate limited, null if allowed
	 */
	checkReactionRateLimit(userId: string): ChatErrorCode | null {
		const state = this.getRateLimitState(userId);
		const now = Date.now();

		// Reset window if expired
		if (now - state.reactionWindowStart > RATE_LIMITS.REACTION_WINDOW_MS) {
			state.reactionCount = 0;
			state.reactionWindowStart = now;
		}

		if (state.reactionCount >= RATE_LIMITS.REACTIONS_PER_WINDOW) {
			return 'RATE_LIMITED';
		}

		return null;
	}

	// ===========================================================================
	// Message Handlers
	// ===========================================================================

	/**
	 * Handle a text chat message
	 * @returns ChatMessage to broadcast, or error response
	 */
	async handleTextMessage(
		userId: string,
		displayName: string,
		content: string,
	): Promise<
		| { success: true; message: ChatMessage }
		| { success: false; error: ChatErrorCode; errorMessage: string }
	> {
		// Rate limit check
		const rateLimitError = this.checkMessageRateLimit(userId);
		if (rateLimitError) {
			return { success: false, error: rateLimitError, errorMessage: 'Sending messages too fast' };
		}

		// Content length already validated by schema, but double-check
		if (content.length > RATE_LIMITS.MAX_MESSAGE_LENGTH) {
			return {
				success: false,
				error: 'MESSAGE_TOO_LONG',
				errorMessage: `Message exceeds ${RATE_LIMITS.MAX_MESSAGE_LENGTH} characters`,
			};
		}

		// Create message
		const message: ChatMessage = {
			id: nanoid(),
			type: 'text',
			userId,
			displayName,
			content: content.trim(),
			timestamp: Date.now(),
			reactions: createEmptyReactions(),
		};

		// Update rate limit state
		const state = this.getRateLimitState(userId);
		state.lastMessageAt = message.timestamp;

		// Clear typing indicator for this user
		this.typingUsers.delete(userId);

		// Persist
		await Promise.all([this.saveMessage(message), this.persistRateLimits()]);

		return { success: true, message };
	}

	/**
	 * Handle a quick chat message
	 * @returns ChatMessage to broadcast, or error response
	 */
	async handleQuickChat(
		userId: string,
		displayName: string,
		key: QuickChatKey,
	): Promise<
		| { success: true; message: ChatMessage }
		| { success: false; error: ChatErrorCode; errorMessage: string }
	> {
		// Rate limit check (same as regular messages)
		const rateLimitError = this.checkMessageRateLimit(userId);
		if (rateLimitError) {
			return { success: false, error: rateLimitError, errorMessage: 'Sending messages too fast' };
		}

		const preset = QUICK_CHAT_MESSAGES[key];
		if (!preset) {
			return { success: false, error: 'INVALID_MESSAGE', errorMessage: 'Invalid quick chat key' };
		}

		// Create message with formatted content
		const message: ChatMessage = {
			id: nanoid(),
			type: 'quick',
			userId,
			displayName,
			content: `${preset.emoji} ${preset.text}`,
			timestamp: Date.now(),
			reactions: createEmptyReactions(),
		};

		// Update rate limit state
		const state = this.getRateLimitState(userId);
		state.lastMessageAt = message.timestamp;

		// Persist
		await Promise.all([this.saveMessage(message), this.persistRateLimits()]);

		return { success: true, message };
	}

	/**
	 * Handle a reaction add/remove
	 * @returns Updated reactions for broadcast, or error response
	 */
	async handleReaction(
		userId: string,
		messageId: string,
		emoji: ReactionEmoji,
		action: 'add' | 'remove',
	): Promise<
		| { success: true; messageId: string; reactions: MessageReactions }
		| { success: false; error: ChatErrorCode; errorMessage: string }
	> {
		// Validate emoji
		if (!REACTION_EMOJIS.includes(emoji)) {
			return { success: false, error: 'INVALID_MESSAGE', errorMessage: 'Invalid reaction emoji' };
		}

		// Find message
		const message = this.findMessage(messageId);
		if (!message) {
			return { success: false, error: 'MESSAGE_NOT_FOUND', errorMessage: 'Message not found' };
		}

		// Rate limit check (only for adding)
		if (action === 'add') {
			const rateLimitError = this.checkReactionRateLimit(userId);
			if (rateLimitError) {
				return { success: false, error: rateLimitError, errorMessage: 'Adding reactions too fast' };
			}
		}

		// Update reactions
		const users = message.reactions[emoji];
		const userIndex = users.indexOf(userId);

		if (action === 'add' && userIndex === -1) {
			users.push(userId);
			// Update rate limit
			const state = this.getRateLimitState(userId);
			if (Date.now() - state.reactionWindowStart > RATE_LIMITS.REACTION_WINDOW_MS) {
				state.reactionWindowStart = Date.now();
				state.reactionCount = 1;
			} else {
				state.reactionCount++;
			}
			await this.persistRateLimits();
		} else if (action === 'remove' && userIndex !== -1) {
			users.splice(userIndex, 1);
		}

		// Persist messages
		await this.ctx.storage.put(STORAGE_KEYS.MESSAGES, this.messages);

		return { success: true, messageId, reactions: message.reactions };
	}

	// ===========================================================================
	// Typing Indicators
	// ===========================================================================

	/**
	 * Handle typing start indicator
	 * @returns true if indicator was updated and should be broadcast
	 */
	handleTypingStart(userId: string, displayName: string): boolean {
		if (!this.checkTypingRateLimit(userId)) {
			return false;
		}

		const state = this.getRateLimitState(userId);
		state.lastTypingAt = Date.now();

		this.typingUsers.set(userId, {
			userId,
			displayName,
			startedAt: Date.now(),
		});

		return true;
	}

	/**
	 * Handle typing stop indicator
	 * @returns true if user was typing and should broadcast update
	 */
	handleTypingStop(userId: string): boolean {
		return this.typingUsers.delete(userId);
	}

	/**
	 * Get current typing users (filtered by timeout)
	 */
	getTypingUsers(): TypingState[] {
		const now = Date.now();
		const active: TypingState[] = [];

		for (const [userId, state] of this.typingUsers) {
			if (now - state.startedAt < RATE_LIMITS.TYPING_TIMEOUT_MS) {
				active.push(state);
			} else {
				// Clean up expired
				this.typingUsers.delete(userId);
			}
		}

		return active;
	}

	/**
	 * Clear typing indicator for a user (e.g., when they disconnect)
	 */
	clearTyping(userId: string): boolean {
		return this.typingUsers.delete(userId);
	}

	// ===========================================================================
	// System Messages
	// ===========================================================================

	/**
	 * Create a system message (e.g., player joined/left)
	 */
	async createSystemMessage(content: string): Promise<ChatMessage> {
		const message: ChatMessage = {
			id: nanoid(),
			type: 'system',
			userId: 'system',
			displayName: 'System',
			content,
			timestamp: Date.now(),
			reactions: createEmptyReactions(),
		};

		await this.saveMessage(message);
		return message;
	}

	// ===========================================================================
	// Cleanup
	// ===========================================================================

	/**
	 * Remove all data for a user (when they leave)
	 */
	async removeUser(userId: string): Promise<void> {
		this.rateLimits.delete(userId);
		this.typingUsers.delete(userId);
		await this.persistRateLimits();
	}

	/**
	 * Clear all chat data (for room reset)
	 */
	async clearAll(): Promise<void> {
		this.messages = [];
		this.rateLimits.clear();
		this.typingUsers.clear();

		await Promise.all([
			this.ctx.storage.delete(STORAGE_KEYS.MESSAGES),
			this.ctx.storage.delete(STORAGE_KEYS.RATE_LIMITS),
		]);
	}
}

// =============================================================================
// Server Message Helpers
// =============================================================================

/**
 * Create CHAT_MESSAGE server message
 */
export function createChatMessageResponse(message: ChatMessage): ChatServerMessage {
	return { type: 'CHAT_MESSAGE', payload: message };
}

/**
 * Create CHAT_HISTORY server message
 */
export function createChatHistoryResponse(messages: ChatMessage[]): ChatServerMessage {
	return { type: 'CHAT_HISTORY', payload: messages };
}

/**
 * Create REACTION_UPDATE server message
 */
export function createReactionUpdateResponse(
	messageId: string,
	reactions: MessageReactions,
): ChatServerMessage {
	return { type: 'REACTION_UPDATE', payload: { messageId, reactions } };
}

/**
 * Create TYPING_UPDATE server message
 */
export function createTypingUpdateResponse(typing: TypingState[]): ChatServerMessage {
	return { type: 'TYPING_UPDATE', payload: { typing } };
}

/**
 * Create CHAT_ERROR server message
 */
export function createChatErrorResponse(code: ChatErrorCode, message: string): ChatServerMessage {
	return { type: 'CHAT_ERROR', payload: { code, message } };
}
