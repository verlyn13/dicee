/**
 * Zod 4 Validation Schemas for GlobalLobby
 *
 * Runtime validation schemas for lobby WebSocket messages.
 * Uses UPPERCASE_SNAKE_CASE format matching wire protocol.
 *
 * @example
 * import { LobbyCommandSchema, parseLobbyCommand } from '@dicee/shared';
 *
 * const result = parseLobbyCommand(rawMessage);
 * if (result.success) {
 *   // result.data is typed as LobbyCommand
 * }
 */

import { z } from 'zod';

// =============================================================================
// Lobby-Specific Type Schemas
// =============================================================================

/**
 * Room code: 6 uppercase alphanumeric (no ambiguous chars: 0,O,1,I,L)
 */
export const LobbyRoomCodeSchema = z
	.string()
	.length(6, { error: 'Room code must be exactly 6 characters' })
	.regex(/^[A-HJ-NP-Z2-9]+$/, { error: 'Invalid room code format' })
	.transform((val) => val.toUpperCase());

/**
 * Lobby user presence
 */
export const LobbyUserSchema = z.object({
	userId: z.string().min(1),
	displayName: z.string().min(1).max(30),
	avatarSeed: z.string(),
	currentRoomCode: z.string().length(6).nullable(),
});

/**
 * Room info for lobby browser
 */
export const LobbyRoomInfoSchema = z.object({
	code: z.string().length(6),
	hostId: z.string().min(1),
	hostName: z.string().min(1).max(30),
	isPublic: z.boolean(),
	playerCount: z.number().int().min(0).max(4),
	maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]),
	status: z.enum(['waiting', 'starting', 'playing', 'completed', 'abandoned']),
	createdAt: z.number().int().positive(),
});

/**
 * Lobby chat message
 */
export const LobbyChatMessageSchema = z.object({
	id: z.string().min(1),
	userId: z.string().min(1),
	displayName: z.string().min(1).max(30),
	content: z.string().min(1).max(500),
	timestamp: z.number().int().positive(),
});

/**
 * Game invite
 */
export const GameInviteSchema = z.object({
	id: z.string().min(1),
	roomCode: z.string().length(6),
	fromUserId: z.string().min(1),
	fromDisplayName: z.string().min(1).max(30),
	toUserId: z.string().min(1),
	createdAt: z.number().int().positive(),
	expiresAt: z.number().int().positive(),
});

// =============================================================================
// Command Schemas (Client → Server)
// =============================================================================

/** LOBBY_CHAT command */
export const LobbyChatCommandSchema = z.object({
	type: z.literal('LOBBY_CHAT'),
	payload: z.object({
		content: z.string().min(1, { error: 'Message cannot be empty' }).max(500, { error: 'Message too long' }),
	}),
});

/** GET_ROOMS command */
export const GetRoomsCommandSchema = z.object({
	type: z.literal('GET_ROOMS'),
});

/** ROOM_CREATED command */
export const RoomCreatedCommandSchema = z.object({
	type: z.literal('ROOM_CREATED'),
	payload: z.object({
		room: LobbyRoomInfoSchema,
	}),
});

/** ROOM_UPDATED command */
export const RoomUpdatedCommandSchema = z.object({
	type: z.literal('ROOM_UPDATED'),
	payload: z.object({
		room: LobbyRoomInfoSchema,
	}),
});

/** ROOM_CLOSED command */
export const RoomClosedCommandSchema = z.object({
	type: z.literal('ROOM_CLOSED'),
	payload: z.object({
		code: z.string().length(6),
	}),
});

/** GET_ONLINE_USERS command */
export const GetOnlineUsersCommandSchema = z.object({
	type: z.literal('GET_ONLINE_USERS'),
});

/** REQUEST_JOIN command */
export const RequestJoinCommandSchema = z.object({
	type: z.literal('REQUEST_JOIN'),
	payload: z.object({
		roomCode: LobbyRoomCodeSchema,
	}),
});

/** CANCEL_JOIN_REQUEST command */
export const CancelJoinRequestCommandSchema = z.object({
	type: z.literal('CANCEL_JOIN_REQUEST'),
	payload: z.object({
		requestId: z.string().min(1),
		roomCode: z.string().length(6),
	}),
});

/** SEND_INVITE command */
export const SendInviteCommandSchema = z.object({
	type: z.literal('SEND_INVITE'),
	payload: z.object({
		toUserId: z.string().min(1),
		roomCode: z.string().length(6),
	}),
});

/** CANCEL_INVITE command */
export const CancelInviteCommandSchema = z.object({
	type: z.literal('CANCEL_INVITE'),
	payload: z.object({
		inviteId: z.string().min(1),
	}),
});

/**
 * All lobby commands - discriminated union
 */
export const LobbyCommandSchema = z.discriminatedUnion('type', [
	LobbyChatCommandSchema,
	GetRoomsCommandSchema,
	RoomCreatedCommandSchema,
	RoomUpdatedCommandSchema,
	RoomClosedCommandSchema,
	GetOnlineUsersCommandSchema,
	RequestJoinCommandSchema,
	CancelJoinRequestCommandSchema,
	SendInviteCommandSchema,
	CancelInviteCommandSchema,
]);

/** Input type for lobby commands */
export type LobbyCommandInput = z.input<typeof LobbyCommandSchema>;

// =============================================================================
// Server Event Schemas (Server → Client)
// =============================================================================

const BaseEventSchema = z.object({
	timestamp: z.string(),
});

/** PRESENCE_INIT event */
export const PresenceInitEventSchema = BaseEventSchema.extend({
	type: z.literal('PRESENCE_INIT'),
	payload: z.object({
		onlineCount: z.number().int().min(0),
	}),
});

/** PRESENCE_JOIN event */
export const PresenceJoinEventSchema = BaseEventSchema.extend({
	type: z.literal('PRESENCE_JOIN'),
	payload: z.object({
		userId: z.string().min(1),
		displayName: z.string().min(1).max(30),
		avatarSeed: z.string(),
		onlineCount: z.number().int().min(0),
	}),
});

/** PRESENCE_LEAVE event */
export const PresenceLeaveEventSchema = BaseEventSchema.extend({
	type: z.literal('PRESENCE_LEAVE'),
	payload: z.object({
		userId: z.string().min(1),
		displayName: z.string().min(1).max(30),
		onlineCount: z.number().int().min(0),
	}),
});

/** LOBBY_ROOMS_LIST event */
export const LobbyRoomsListEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_ROOMS_LIST'),
	payload: z.object({
		rooms: z.array(LobbyRoomInfoSchema),
	}),
});

/** LOBBY_ROOM_UPDATE event */
export const LobbyRoomUpdateEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_ROOM_UPDATE'),
	payload: z.object({
		action: z.enum(['created', 'updated', 'closed']),
		room: LobbyRoomInfoSchema.optional(),
		code: z.string().optional(),
	}),
});

/** LOBBY_CHAT_MESSAGE event */
export const LobbyChatMessageEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_CHAT_MESSAGE'),
	payload: LobbyChatMessageSchema,
});

/** LOBBY_CHAT_HISTORY event */
export const LobbyChatHistoryEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_CHAT_HISTORY'),
	payload: z.object({
		messages: z.array(LobbyChatMessageSchema),
	}),
});

/** LOBBY_ONLINE_USERS event */
export const LobbyOnlineUsersEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_ONLINE_USERS'),
	payload: z.object({
		users: z.array(LobbyUserSchema),
	}),
});

/** INVITE_RECEIVED event */
export const InviteReceivedEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_RECEIVED'),
	payload: z.object({
		invite: GameInviteSchema,
	}),
});

/** INVITE_CANCELLED event */
export const InviteCancelledEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_CANCELLED'),
	payload: z.object({
		inviteId: z.string().min(1),
	}),
});

/** JOIN_REQUEST_SENT event */
export const JoinRequestSentEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_SENT'),
	payload: z.object({
		requestId: z.string().min(1),
		roomCode: z.string().length(6),
	}),
});

/** JOIN_REQUEST_CANCELLED event */
export const JoinRequestCancelledEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_CANCELLED'),
	payload: z.object({
		requestId: z.string().min(1),
		roomCode: z.string().length(6),
	}),
});

/** JOIN_REQUEST_ERROR event */
export const JoinRequestErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_ERROR'),
	payload: z.object({
		message: z.string().min(1),
		roomCode: z.string().optional(),
	}),
});

/** LOBBY_HIGHLIGHT event */
export const LobbyHighlightEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_HIGHLIGHT'),
	payload: z.object({
		type: z.enum(['dicee', 'game_won', 'streak']),
		playerName: z.string().min(1),
		roomCode: z.string().length(6),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});

/** LOBBY_ERROR event */
export const LobbyErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('LOBBY_ERROR'),
	payload: z.object({
		message: z.string().min(1),
		code: z.string().optional(),
	}),
});

/**
 * All lobby server events - discriminated union
 */
export const LobbyServerEventSchema = z.discriminatedUnion('type', [
	// Presence
	PresenceInitEventSchema,
	PresenceJoinEventSchema,
	PresenceLeaveEventSchema,
	// Rooms
	LobbyRoomsListEventSchema,
	LobbyRoomUpdateEventSchema,
	// Chat
	LobbyChatMessageEventSchema,
	LobbyChatHistoryEventSchema,
	// Users
	LobbyOnlineUsersEventSchema,
	// Invites
	InviteReceivedEventSchema,
	InviteCancelledEventSchema,
	// Join requests
	JoinRequestSentEventSchema,
	JoinRequestCancelledEventSchema,
	JoinRequestErrorEventSchema,
	// Highlights
	LobbyHighlightEventSchema,
	// Errors
	LobbyErrorEventSchema,
]);

/** Input type for lobby server events */
export type LobbyServerEventInput = z.input<typeof LobbyServerEventSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a lobby command from raw input
 */
export function parseLobbyCommand(input: unknown) {
	return LobbyCommandSchema.safeParse(input);
}

/**
 * Parse and validate a lobby server event from raw input
 */
export function parseLobbyServerEvent(input: unknown) {
	return LobbyServerEventSchema.safeParse(input);
}

/**
 * Validate a lobby room code
 */
export function isValidLobbyRoomCode(code: string): boolean {
	return LobbyRoomCodeSchema.safeParse(code).success;
}

/**
 * Validate a lobby chat message content
 */
export function isValidLobbyChatContent(content: string): boolean {
	return content.length >= 1 && content.length <= 500;
}
