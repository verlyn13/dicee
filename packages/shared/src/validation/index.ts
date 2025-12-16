/**
 * Validation Module
 *
 * Zod schemas and validation utilities for runtime message validation.
 */

export * from './schemas.js';
export * from './preferences.js';
export * from './result.js';

// Lobby schemas
export {
	// Type schemas
	LobbyRoomCodeSchema,
	LobbyUserSchema,
	LobbyRoomInfoSchema,
	LobbyChatMessageSchema,
	GameInviteSchema,
	// Command schemas
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
	LobbyCommandSchema,
	// Event schemas
	PresenceInitEventSchema,
	PresenceJoinEventSchema,
	PresenceLeaveEventSchema,
	LobbyRoomsListEventSchema,
	LobbyRoomUpdateEventSchema,
	LobbyChatMessageEventSchema,
	LobbyChatHistoryEventSchema,
	LobbyOnlineUsersEventSchema,
	InviteReceivedEventSchema,
	InviteCancelledEventSchema,
	JoinRequestSentEventSchema,
	JoinRequestCancelledEventSchema,
	JoinRequestErrorEventSchema,
	LobbyHighlightEventSchema,
	LobbyErrorEventSchema,
	LobbyServerEventSchema,
	// Validation helpers
	parseLobbyCommand,
	parseLobbyServerEvent,
	isValidLobbyRoomCode,
	isValidLobbyChatContent,
} from './lobby-schemas.js';

export type {
	LobbyCommandInput,
	LobbyServerEventInput,
} from './lobby-schemas.js';
