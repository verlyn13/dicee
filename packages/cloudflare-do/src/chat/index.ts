/**
 * Chat Module Exports
 *
 * Lobby chat system: messages, reactions, typing indicators, rate limiting.
 */

// Types
export type {
	ChatMessage,
	MessageReactions,
	ReactionEmoji,
	QuickChatKey,
	TypingState,
	ChatClientMessage,
	ChatServerMessage,
	RateLimitState,
	ChatErrorCode,
} from './types';

export {
	REACTION_EMOJIS,
	QUICK_CHAT_KEYS,
	QUICK_CHAT_MESSAGES,
	RATE_LIMITS,
	createEmptyReactions,
} from './types';

// Schemas
export {
	chatMessageSchema,
	quickChatSchema,
	reactionSchema,
	typingStartSchema,
	typingStopSchema,
	chatClientMessageSchema,
	validateChatMessage,
	isChatMessageType,
} from './schemas';

export type { ValidatedChatMessage } from './schemas';

// Manager
export { ChatManager } from './ChatManager';

// Server Message Helpers
export {
	createChatMessageResponse,
	createChatHistoryResponse,
	createReactionUpdateResponse,
	createTypingUpdateResponse,
	createChatErrorResponse,
} from './ChatManager';
