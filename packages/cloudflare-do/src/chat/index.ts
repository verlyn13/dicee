/**
 * Chat Module Exports
 *
 * Lobby chat system: messages, reactions, typing indicators, rate limiting.
 */

// Manager
// Server Message Helpers
export {
	ChatManager,
	createChatErrorResponse,
	createChatHistoryResponse,
	createChatMessageResponse,
	createReactionUpdateResponse,
	createTypingUpdateResponse,
} from './ChatManager';
export type { ValidatedChatMessage } from './schemas';
// Schemas
export {
	chatClientMessageSchema,
	chatMessageSchema,
	isChatMessageType,
	quickChatSchema,
	reactionSchema,
	typingStartSchema,
	typingStopSchema,
	validateChatMessage,
} from './schemas';
// Types
export type {
	ChatClientMessage,
	ChatErrorCode,
	ChatMessage,
	ChatServerMessage,
	MessageReactions,
	QuickChatKey,
	RateLimitState,
	ReactionEmoji,
	TypingState,
} from './types';
export {
	createEmptyReactions,
	QUICK_CHAT_KEYS,
	QUICK_CHAT_MESSAGES,
	RATE_LIMITS,
	REACTION_EMOJIS,
} from './types';
