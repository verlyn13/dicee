/**
 * Chat Message Schemas
 *
 * Zod validation schemas for chat messages from clients.
 */

import { z } from 'zod';
import { QUICK_CHAT_KEYS, REACTION_EMOJIS, RATE_LIMITS } from './types';

// =============================================================================
// Individual Message Schemas
// =============================================================================

/**
 * Text chat message schema
 */
export const chatMessageSchema = z.object({
	type: z.literal('CHAT'),
	payload: z.object({
		content: z
			.string()
			.min(1, 'Message cannot be empty')
			.max(RATE_LIMITS.MAX_MESSAGE_LENGTH, `Message cannot exceed ${RATE_LIMITS.MAX_MESSAGE_LENGTH} characters`)
			.transform((s) => s.trim()),
	}),
});

/**
 * Quick chat message schema
 */
export const quickChatSchema = z.object({
	type: z.literal('QUICK_CHAT'),
	payload: z.object({
		key: z.enum(QUICK_CHAT_KEYS as [string, ...string[]]),
	}),
});

/**
 * Reaction message schema
 */
export const reactionSchema = z.object({
	type: z.literal('REACTION'),
	payload: z.object({
		messageId: z.string().min(1, 'Message ID required'),
		emoji: z.enum(REACTION_EMOJIS as [string, ...string[]]),
		action: z.enum(['add', 'remove']),
	}),
});

/**
 * Typing indicator schema
 */
export const typingStartSchema = z.object({
	type: z.literal('TYPING_START'),
});

export const typingStopSchema = z.object({
	type: z.literal('TYPING_STOP'),
});

// =============================================================================
// Combined Schema
// =============================================================================

/**
 * Combined schema for all chat-related client messages
 */
export const chatClientMessageSchema = z.discriminatedUnion('type', [
	chatMessageSchema,
	quickChatSchema,
	reactionSchema,
	typingStartSchema,
	typingStopSchema,
]);

export type ValidatedChatMessage = z.infer<typeof chatClientMessageSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a chat client message
 */
export function validateChatMessage(input: unknown): z.SafeParseReturnType<unknown, ValidatedChatMessage> {
	return chatClientMessageSchema.safeParse(input);
}

/**
 * Check if a message type is chat-related
 */
export function isChatMessageType(type: string): boolean {
	return ['CHAT', 'QUICK_CHAT', 'REACTION', 'TYPING_START', 'TYPING_STOP'].includes(type);
}
