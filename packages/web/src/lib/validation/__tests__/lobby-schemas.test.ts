/**
 * Lobby Schema Validation Tests
 *
 * Tests for @dicee/shared lobby message schemas.
 * Ensures UPPERCASE protocol compliance and proper validation.
 */

import {
	GetRoomsCommandSchema,
	isValidLobbyChatContent,
	isValidLobbyRoomCode,
	LOBBY_COMMAND_TYPES,
	LOBBY_SERVER_EVENT_TYPES,
	LobbyChatCommandSchema,
	LobbyChatMessageEventSchema,
	LobbyCommandSchema,
	LobbyRoomCodeSchema,
	LobbyRoomsListEventSchema,
	LobbyRoomUpdateEventSchema,
	LobbyServerEventSchema,
	PresenceInitEventSchema,
	PresenceJoinEventSchema,
	parseLobbyCommand,
	parseLobbyServerEvent,
	RequestJoinCommandSchema,
} from '@dicee/shared';
import { describe, expect, it } from 'vitest';

describe('Lobby Schemas', () => {
	describe('LobbyRoomCodeSchema', () => {
		it('accepts valid 6-character room codes', () => {
			// Valid codes use: A-H, J-N, P-Z, 2-9 (excludes 0, 1, I, O)
			expect(LobbyRoomCodeSchema.safeParse('ABC234').success).toBe(true);
			expect(LobbyRoomCodeSchema.safeParse('XYZ789').success).toBe(true);
			expect(LobbyRoomCodeSchema.safeParse('HJKMNP').success).toBe(true);
		});

		it('rejects lowercase input (regex is case-sensitive)', () => {
			// The regex requires uppercase; transform runs after validation
			expect(LobbyRoomCodeSchema.safeParse('abc234').success).toBe(false);
			expect(LobbyRoomCodeSchema.safeParse('ABC234').success).toBe(true);
		});

		it('rejects codes with ambiguous characters (0, 1, I, O)', () => {
			// Schema excludes: 0, 1, I, O to avoid visual confusion
			expect(LobbyRoomCodeSchema.safeParse('AB0234').success).toBe(false); // 0
			expect(LobbyRoomCodeSchema.safeParse('ABCDE1').success).toBe(false); // 1
			expect(LobbyRoomCodeSchema.safeParse('ABCDEI').success).toBe(false); // I
			expect(LobbyRoomCodeSchema.safeParse('ABCDEO').success).toBe(false); // O
			// Note: L is valid (it's in J-N range)
		});

		it('rejects codes that are not exactly 6 characters', () => {
			expect(LobbyRoomCodeSchema.safeParse('ABC12').success).toBe(false);
			expect(LobbyRoomCodeSchema.safeParse('ABC1234').success).toBe(false);
			expect(LobbyRoomCodeSchema.safeParse('').success).toBe(false);
		});

		it('rejects codes with special characters', () => {
			expect(LobbyRoomCodeSchema.safeParse('ABC12!').success).toBe(false);
			expect(LobbyRoomCodeSchema.safeParse('ABC-12').success).toBe(false);
		});
	});

	describe('Command Schemas', () => {
		describe('LOBBY_CHAT command', () => {
			it('parses valid chat command', () => {
				const result = LobbyChatCommandSchema.safeParse({
					type: 'LOBBY_CHAT',
					payload: { content: 'Hello world!' },
				});
				expect(result.success).toBe(true);
			});

			it('rejects empty content', () => {
				const result = LobbyChatCommandSchema.safeParse({
					type: 'LOBBY_CHAT',
					payload: { content: '' },
				});
				expect(result.success).toBe(false);
			});

			it('rejects content over 500 characters', () => {
				const result = LobbyChatCommandSchema.safeParse({
					type: 'LOBBY_CHAT',
					payload: { content: 'x'.repeat(501) },
				});
				expect(result.success).toBe(false);
			});

			it('accepts content at max length (500 characters)', () => {
				const result = LobbyChatCommandSchema.safeParse({
					type: 'LOBBY_CHAT',
					payload: { content: 'x'.repeat(500) },
				});
				expect(result.success).toBe(true);
			});
		});

		describe('GET_ROOMS command', () => {
			it('parses valid command (no payload)', () => {
				const result = GetRoomsCommandSchema.safeParse({
					type: 'GET_ROOMS',
				});
				expect(result.success).toBe(true);
			});
		});

		describe('REQUEST_JOIN command', () => {
			it('parses valid join request', () => {
				const result = RequestJoinCommandSchema.safeParse({
					type: 'REQUEST_JOIN',
					payload: { roomCode: 'ABC234' },
				});
				expect(result.success).toBe(true);
			});

			it('rejects lowercase room codes', () => {
				// The LobbyRoomCodeSchema regex is case-sensitive
				const result = RequestJoinCommandSchema.safeParse({
					type: 'REQUEST_JOIN',
					payload: { roomCode: 'hjkmnp' },
				});
				expect(result.success).toBe(false);
			});

			it('rejects invalid room codes', () => {
				const result = RequestJoinCommandSchema.safeParse({
					type: 'REQUEST_JOIN',
					payload: { roomCode: 'AB' },
				});
				expect(result.success).toBe(false);
			});
		});

		describe('LobbyCommandSchema discriminated union', () => {
			it('parses all valid command types', () => {
				const commands = [
					{ type: 'LOBBY_CHAT', payload: { content: 'test' } },
					{ type: 'GET_ROOMS' },
					{ type: 'GET_ONLINE_USERS' },
					{ type: 'ROOM_CREATED', payload: { room: validRoom() } },
					{ type: 'ROOM_UPDATED', payload: { room: validRoom() } },
					{ type: 'ROOM_CLOSED', payload: { code: 'ABC234' } },
					{ type: 'REQUEST_JOIN', payload: { roomCode: 'ABC234' } },
					{ type: 'CANCEL_JOIN_REQUEST', payload: { requestId: '123', roomCode: 'ABC234' } },
					{ type: 'SEND_INVITE', payload: { toUserId: 'user-1', roomCode: 'ABC234' } },
					{ type: 'CANCEL_INVITE', payload: { inviteId: 'inv-1' } },
				];

				for (const cmd of commands) {
					const result = LobbyCommandSchema.safeParse(cmd);
					expect(result.success, `Failed for ${cmd.type}`).toBe(true);
				}
			});

			it('rejects unknown command types', () => {
				const result = LobbyCommandSchema.safeParse({
					type: 'UNKNOWN_COMMAND',
					payload: {},
				});
				expect(result.success).toBe(false);
			});

			it('rejects lowercase command types', () => {
				const result = LobbyCommandSchema.safeParse({
					type: 'lobby_chat',
					payload: { content: 'test' },
				});
				expect(result.success).toBe(false);
			});
		});
	});

	describe('Server Event Schemas', () => {
		describe('PRESENCE_INIT event', () => {
			it('parses valid presence init', () => {
				const result = PresenceInitEventSchema.safeParse({
					type: 'PRESENCE_INIT',
					timestamp: '2025-01-01T00:00:00Z',
					payload: { onlineCount: 5 },
				});
				expect(result.success).toBe(true);
			});

			it('rejects negative online count', () => {
				const result = PresenceInitEventSchema.safeParse({
					type: 'PRESENCE_INIT',
					timestamp: '2025-01-01T00:00:00Z',
					payload: { onlineCount: -1 },
				});
				expect(result.success).toBe(false);
			});
		});

		describe('PRESENCE_JOIN event', () => {
			it('parses valid presence join', () => {
				const result = PresenceJoinEventSchema.safeParse({
					type: 'PRESENCE_JOIN',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						userId: 'user-123',
						displayName: 'TestUser',
						avatarSeed: 'seed123',
						onlineCount: 10,
					},
				});
				expect(result.success).toBe(true);
			});

			it('rejects empty userId', () => {
				const result = PresenceJoinEventSchema.safeParse({
					type: 'PRESENCE_JOIN',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						userId: '',
						displayName: 'TestUser',
						avatarSeed: 'seed123',
						onlineCount: 10,
					},
				});
				expect(result.success).toBe(false);
			});
		});

		describe('LOBBY_ROOMS_LIST event', () => {
			it('parses valid rooms list', () => {
				const result = LobbyRoomsListEventSchema.safeParse({
					type: 'LOBBY_ROOMS_LIST',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						rooms: [validRoom(), validRoom()],
					},
				});
				expect(result.success).toBe(true);
			});

			it('parses empty rooms list', () => {
				const result = LobbyRoomsListEventSchema.safeParse({
					type: 'LOBBY_ROOMS_LIST',
					timestamp: '2025-01-01T00:00:00Z',
					payload: { rooms: [] },
				});
				expect(result.success).toBe(true);
			});
		});

		describe('LOBBY_ROOM_UPDATE event', () => {
			it('parses room created action', () => {
				const result = LobbyRoomUpdateEventSchema.safeParse({
					type: 'LOBBY_ROOM_UPDATE',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						action: 'created',
						room: validRoom(),
					},
				});
				expect(result.success).toBe(true);
			});

			it('parses room closed action', () => {
				const result = LobbyRoomUpdateEventSchema.safeParse({
					type: 'LOBBY_ROOM_UPDATE',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						action: 'closed',
						code: 'ABC234',
					},
				});
				expect(result.success).toBe(true);
			});

			it('rejects invalid action', () => {
				const result = LobbyRoomUpdateEventSchema.safeParse({
					type: 'LOBBY_ROOM_UPDATE',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						action: 'deleted', // Invalid
						code: 'ABC234',
					},
				});
				expect(result.success).toBe(false);
			});
		});

		describe('LOBBY_CHAT_MESSAGE event', () => {
			it('parses valid chat message', () => {
				const result = LobbyChatMessageEventSchema.safeParse({
					type: 'LOBBY_CHAT_MESSAGE',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {
						id: 'msg-123',
						userId: 'user-123',
						displayName: 'TestUser',
						content: 'Hello!',
						timestamp: Date.now(),
					},
				});
				expect(result.success).toBe(true);
			});
		});

		describe('LobbyServerEventSchema discriminated union', () => {
			it('parses all valid event types', () => {
				const events = [
					{
						type: 'PRESENCE_INIT',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { onlineCount: 5 },
					},
					{
						type: 'PRESENCE_JOIN',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { userId: 'u1', displayName: 'Test', avatarSeed: 's', onlineCount: 6 },
					},
					{
						type: 'PRESENCE_LEAVE',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { userId: 'u1', displayName: 'Test', onlineCount: 5 },
					},
					{
						type: 'LOBBY_ROOMS_LIST',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { rooms: [] },
					},
					{
						type: 'LOBBY_ROOM_UPDATE',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { action: 'created', room: validRoom() },
					},
					{
						type: 'LOBBY_CHAT_MESSAGE',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { id: 'm1', userId: 'u1', displayName: 'Test', content: 'Hi', timestamp: 123 },
					},
					{
						type: 'LOBBY_CHAT_HISTORY',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { messages: [] },
					},
					{
						type: 'LOBBY_ONLINE_USERS',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { users: [] },
					},
					{
						type: 'INVITE_RECEIVED',
						timestamp: '2025-01-01T00:00:00Z',
						payload: {
							invite: {
								id: 'i1',
								roomCode: 'ABC234',
								fromUserId: 'u1',
								fromDisplayName: 'Test',
								toUserId: 'u2',
								createdAt: 123,
								expiresAt: 456,
							},
						},
					},
					{
						type: 'INVITE_CANCELLED',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { inviteId: 'i1' },
					},
					{
						type: 'JOIN_REQUEST_SENT',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { requestId: 'r1', roomCode: 'ABC234' },
					},
					{
						type: 'JOIN_REQUEST_CANCELLED',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { requestId: 'r1', roomCode: 'ABC234' },
					},
					{
						type: 'JOIN_REQUEST_ERROR',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { message: 'Room full' },
					},
					{
						type: 'LOBBY_HIGHLIGHT',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { type: 'dicee', playerName: 'Test', roomCode: 'ABC234' },
					},
					{
						type: 'LOBBY_ERROR',
						timestamp: '2025-01-01T00:00:00Z',
						payload: { message: 'Error occurred' },
					},
				];

				for (const evt of events) {
					const result = LobbyServerEventSchema.safeParse(evt);
					expect(result.success, `Failed for ${evt.type}`).toBe(true);
				}
			});

			it('rejects unknown event types', () => {
				const result = LobbyServerEventSchema.safeParse({
					type: 'UNKNOWN_EVENT',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {},
				});
				expect(result.success).toBe(false);
			});

			it('rejects lowercase event types', () => {
				const result = LobbyServerEventSchema.safeParse({
					type: 'presence_init',
					timestamp: '2025-01-01T00:00:00Z',
					payload: { onlineCount: 5 },
				});
				expect(result.success).toBe(false);
			});
		});
	});

	describe('Validation Helpers', () => {
		describe('parseLobbyCommand', () => {
			it('returns success for valid command', () => {
				const result = parseLobbyCommand({
					type: 'LOBBY_CHAT',
					payload: { content: 'Hello' },
				});
				expect(result.success).toBe(true);
			});

			it('returns error for invalid command', () => {
				const result = parseLobbyCommand({
					type: 'INVALID',
					payload: {},
				});
				expect(result.success).toBe(false);
			});
		});

		describe('parseLobbyServerEvent', () => {
			it('returns success for valid event', () => {
				const result = parseLobbyServerEvent({
					type: 'PRESENCE_INIT',
					timestamp: '2025-01-01T00:00:00Z',
					payload: { onlineCount: 5 },
				});
				expect(result.success).toBe(true);
			});

			it('returns error for invalid event', () => {
				const result = parseLobbyServerEvent({
					type: 'INVALID',
					timestamp: '2025-01-01T00:00:00Z',
					payload: {},
				});
				expect(result.success).toBe(false);
			});
		});

		describe('isValidLobbyRoomCode', () => {
			it('returns true for valid room codes', () => {
				expect(isValidLobbyRoomCode('ABC234')).toBe(true);
				expect(isValidLobbyRoomCode('XYZ789')).toBe(true);
			});

			it('returns false for invalid room codes', () => {
				expect(isValidLobbyRoomCode('ABC')).toBe(false);
				expect(isValidLobbyRoomCode('ABC1234')).toBe(false);
				expect(isValidLobbyRoomCode('')).toBe(false);
			});
		});

		describe('isValidLobbyChatContent', () => {
			it('returns true for valid content', () => {
				expect(isValidLobbyChatContent('Hello')).toBe(true);
				expect(isValidLobbyChatContent('x'.repeat(500))).toBe(true);
			});

			it('returns false for invalid content', () => {
				expect(isValidLobbyChatContent('')).toBe(false);
				expect(isValidLobbyChatContent('x'.repeat(501))).toBe(false);
			});
		});
	});

	describe('UPPERCASE Protocol Compliance', () => {
		it('all command types are UPPERCASE_SNAKE_CASE', () => {
			for (const type of LOBBY_COMMAND_TYPES) {
				expect(type).toMatch(/^[A-Z][A-Z0-9_]*$/);
			}
		});

		it('all server event types are UPPERCASE_SNAKE_CASE', () => {
			for (const type of LOBBY_SERVER_EVENT_TYPES) {
				expect(type).toMatch(/^[A-Z][A-Z0-9_]*$/);
			}
		});
	});
});

// Helper function to create a valid room object
function validRoom() {
	return {
		code: 'ABC234',
		hostId: 'user-123',
		hostName: 'TestHost',
		isPublic: true,
		playerCount: 1,
		maxPlayers: 4,
		status: 'waiting' as const,
		createdAt: Date.now(),
	};
}
