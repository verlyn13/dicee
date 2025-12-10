/**
 * Chat System Type Definitions
 *
 * Re-exports common types from @dicee/shared and defines DO-specific
 * types for lobby chat: client/server messages, rate limiting.
 */

// =============================================================================
// Re-export common types from @dicee/shared
// =============================================================================

export type { ReactionEmoji, QuickChatKey, MessageReactions, ChatMessage, TypingState, ChatErrorCode } from '@dicee/shared';
export { REACTION_EMOJIS, QUICK_CHAT_MESSAGES, QUICK_CHAT_KEYS, CHAT_RATE_LIMITS, createEmptyReactions } from '@dicee/shared';

// =============================================================================
// Client → Server Messages (DO-specific)
// =============================================================================

import type { QuickChatKey, ReactionEmoji } from '@dicee/shared';

/**
 * Chat messages from client to server
 */
export type ChatClientMessage =
	| { type: 'CHAT'; payload: { content: string } }
	| { type: 'QUICK_CHAT'; payload: { key: QuickChatKey } }
	| { type: 'REACTION'; payload: { messageId: string; emoji: ReactionEmoji; action: 'add' | 'remove' } }
	| { type: 'TYPING_START' }
	| { type: 'TYPING_STOP' };

// =============================================================================
// Server → Client Messages (DO-specific)
// =============================================================================

import type { ChatMessage, MessageReactions, TypingState } from '@dicee/shared';

/**
 * Chat messages from server to client
 */
export type ChatServerMessage =
	| { type: 'CHAT_MESSAGE'; payload: ChatMessage }
	| { type: 'CHAT_HISTORY'; payload: ChatMessage[] }
	| { type: 'REACTION_UPDATE'; payload: { messageId: string; reactions: MessageReactions } }
	| { type: 'TYPING_UPDATE'; payload: { typing: TypingState[] } }
	| { type: 'CHAT_ERROR'; payload: { code: string; message: string } };

// =============================================================================
// Rate Limiting (DO-specific)
// =============================================================================

/**
 * Per-user rate limit tracking (server-side)
 */
export interface RateLimitState {
	lastMessageAt: number;
	lastTypingAt: number;
	reactionCount: number;
	reactionWindowStart: number;
}

/**
 * Server-side rate limit configuration (extends shared CHAT_RATE_LIMITS)
 */
export const RATE_LIMITS = {
	/** Minimum interval between messages (ms) */
	MESSAGE_INTERVAL_MS: 1000,
	/** Minimum interval between typing updates (ms) */
	TYPING_INTERVAL_MS: 2000,
	/** Max reactions per window */
	REACTIONS_PER_WINDOW: 5,
	/** Reaction rate limit window (ms) */
	REACTION_WINDOW_MS: 1000,
	/** Maximum message length */
	MAX_MESSAGE_LENGTH: 500,
	/** Number of messages to keep in history */
	MESSAGE_HISTORY_SIZE: 20,
	/** Auto-clear typing indicator after (ms) */
	TYPING_TIMEOUT_MS: 3000,
} as const;
