/**
 * Chat Types
 *
 * Chat message and reaction types for game rooms.
 */

/** Reaction emoji type */
export type ReactionEmoji = '👍' | '🎲' | '😱' | '💀' | '🎉';

/** All available reaction emojis */
export const REACTION_EMOJIS: readonly ReactionEmoji[] = ['👍', '🎲', '😱', '💀', '🎉'] as const;

/** Quick chat preset keys */
export type QuickChatKey = 'nice_roll' | 'good_game' | 'your_turn' | 'dicee' | 'ouch' | 'thinking';

/** Quick chat presets with emoji and text */
export const QUICK_CHAT_MESSAGES: Record<QuickChatKey, { emoji: string; text: string }> = {
	nice_roll: { emoji: '🎲', text: 'Nice roll!' },
	good_game: { emoji: '👏', text: 'Good game!' },
	your_turn: { emoji: '⏰', text: 'Your turn!' },
	dicee: { emoji: '🎉', text: 'DICEE!' },
	ouch: { emoji: '💀', text: 'Ouch...' },
	thinking: { emoji: '🤔', text: 'Hmm, let me think...' },
};

/** All quick chat keys */
export const QUICK_CHAT_KEYS: readonly QuickChatKey[] = Object.keys(QUICK_CHAT_MESSAGES) as QuickChatKey[];

/** Reactions on a message, keyed by emoji */
export interface MessageReactions {
	'👍': string[];
	'🎲': string[];
	'😱': string[];
	'💀': string[];
	'🎉': string[];
}

/** Create empty reactions object */
export function createEmptyReactions(): MessageReactions {
	return {
		'👍': [],
		'🎲': [],
		'😱': [],
		'💀': [],
		'🎉': [],
	};
}

/** Chat message from server */
export interface ChatMessage {
	/** Unique message ID */
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

/** Typing state for a user */
export interface TypingState {
	userId: string;
	displayName: string;
	startedAt: number;
}

/** Chat rate limits (for client-side UX hints) */
export const CHAT_RATE_LIMITS = {
	/** Minimum interval between messages (ms) */
	MESSAGE_INTERVAL_MS: 1000,
	/** Maximum message length */
	MAX_MESSAGE_LENGTH: 500,
	/** Auto-clear typing indicator after (ms) */
	TYPING_TIMEOUT_MS: 3000,
} as const;

/** Chat error codes */
export type ChatErrorCode =
	| 'INVALID_MESSAGE'
	| 'RATE_LIMITED'
	| 'MESSAGE_TOO_LONG'
	| 'REACTION_FAILED'
	| 'MESSAGE_NOT_FOUND';
