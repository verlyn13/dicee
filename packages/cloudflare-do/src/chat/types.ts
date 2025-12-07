/**
 * Chat System Type Definitions
 *
 * Shared types for lobby chat: text messages, quick chat, reactions,
 * typing indicators, and rate limiting.
 */

// =============================================================================
// Chat Message Types
// =============================================================================

/**
 * Chat message stored in history and broadcast to clients
 */
export interface ChatMessage {
	/** Unique message ID (nanoid) */
	id: string;
	/** Message type: text, quick preset, or system announcement */
	type: 'text' | 'quick' | 'system';
	/** User ID who sent the message */
	userId: string;
	/** Display name at time of message */
	displayName: string;
	/** Message content (text or formatted quick chat) */
	content: string;
	/** Unix timestamp in milliseconds */
	timestamp: number;
	/** Aggregated reactions from all users */
	reactions: MessageReactions;
}

/**
 * Reactions on a message, keyed by emoji
 * Value is array of userIds who reacted
 */
export interface MessageReactions {
	'👍': string[];
	'🎲': string[];
	'😱': string[];
	'💀': string[];
	'🎉': string[];
}

/** Available reaction emojis */
export type ReactionEmoji = keyof MessageReactions;

/** All reaction emojis as array */
export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '🎲', '😱', '💀', '🎉'];

/**
 * Create empty reactions object
 */
export function createEmptyReactions(): MessageReactions {
	return {
		'👍': [],
		'🎲': [],
		'😱': [],
		'💀': [],
		'🎉': [],
	};
}

// =============================================================================
// Quick Chat Definitions
// =============================================================================

/** Quick chat preset keys */
export type QuickChatKey = 'nice_roll' | 'good_game' | 'your_turn' | 'yahtzee' | 'ouch' | 'thinking';

/** Quick chat presets with emoji and text */
export const QUICK_CHAT_MESSAGES: Record<QuickChatKey, { emoji: string; text: string }> = {
	nice_roll: { emoji: '🎲', text: 'Nice roll!' },
	good_game: { emoji: '👏', text: 'Good game!' },
	your_turn: { emoji: '⏰', text: 'Your turn!' },
	yahtzee: { emoji: '🎉', text: 'YAHTZEE!' },
	ouch: { emoji: '💀', text: 'Ouch...' },
	thinking: { emoji: '🤔', text: 'Hmm, let me think...' },
};

/** All quick chat keys as array */
export const QUICK_CHAT_KEYS = Object.keys(QUICK_CHAT_MESSAGES) as QuickChatKey[];

// =============================================================================
// Typing Indicator
// =============================================================================

/**
 * Typing state for a user
 */
export interface TypingState {
	userId: string;
	displayName: string;
	startedAt: number;
}

// =============================================================================
// Client → Server Messages
// =============================================================================

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
// Server → Client Messages
// =============================================================================

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
// Rate Limiting
// =============================================================================

/**
 * Per-user rate limit tracking
 */
export interface RateLimitState {
	lastMessageAt: number;
	lastTypingAt: number;
	reactionCount: number;
	reactionWindowStart: number;
}

/**
 * Rate limit configuration
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

// =============================================================================
// Chat Error Codes
// =============================================================================

export type ChatErrorCode =
	| 'INVALID_MESSAGE'
	| 'RATE_LIMITED'
	| 'MESSAGE_TOO_LONG'
	| 'REACTION_FAILED'
	| 'MESSAGE_NOT_FOUND';
