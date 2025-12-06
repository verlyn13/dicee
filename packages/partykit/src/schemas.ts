/**
 * Zod 4 Schemas for PartyKit Server
 *
 * Runtime validation for WebSocket messages.
 *
 * Zod 4 Key Patterns:
 * - Use `{ error: "..." }` not `{ message: "..." }`
 * - String formats are top-level: z.uuid(), z.email()
 * - z.record() requires TWO arguments (key, value)
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Room code: 6 uppercase alphanumeric (no ambiguous chars: 0,O,1,I,L)
 */
export const RoomCodeSchema = z
	.string()
	.length(6, { error: 'Room code must be exactly 6 characters' })
	.regex(/^[A-HJ-NP-Z2-9]+$/, { error: 'Invalid room code format' })
	.transform((val) => val.toUpperCase());

/**
 * Display name validation
 */
export const DisplayNameSchema = z
	.string()
	.min(1, { error: 'Display name is required' })
	.max(30, { error: 'Display name must be 30 characters or less' })
	.trim();

// =============================================================================
// Room Configuration Schema
// =============================================================================

export const RoomConfigSchema = z.object({
	isPublic: z.boolean().default(false),
	allowSpectators: z.boolean().default(false),
	turnTimeoutSeconds: z.number().int().min(0).max(300).default(60),
	maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
});

// =============================================================================
// Command Schemas (Client → Server)
// =============================================================================

export const CreateRoomCommandSchema = z.object({
	type: z.literal('room.create'),
	config: RoomConfigSchema.partial().optional(),
});

export const JoinRoomCommandSchema = z.object({
	type: z.literal('room.join'),
	displayName: DisplayNameSchema,
	avatarSeed: z.string().optional(),
});

export const LeaveRoomCommandSchema = z.object({
	type: z.literal('room.leave'),
});

export const StartGameCommandSchema = z.object({
	type: z.literal('game.start'),
});

export const RollDiceCommandSchema = z.object({
	type: z.literal('dice.roll'),
	kept: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
});

export const KeepDiceCommandSchema = z.object({
	type: z.literal('dice.keep'),
	indices: z.array(z.number().int().min(0).max(4)).max(5),
});

export const ScoreCategoryCommandSchema = z.object({
	type: z.literal('category.score'),
	category: z.string().min(1),
});

/**
 * All commands - discriminated union
 */
export const CommandSchema = z.discriminatedUnion('type', [
	CreateRoomCommandSchema,
	JoinRoomCommandSchema,
	LeaveRoomCommandSchema,
	StartGameCommandSchema,
	RollDiceCommandSchema,
	KeepDiceCommandSchema,
	ScoreCategoryCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a command from raw input
 */
export function parseCommand(input: unknown) {
	return CommandSchema.safeParse(input);
}

// =============================================================================
// Room Code Generation
// =============================================================================

/** Alphabet for room codes (no ambiguous chars: 0,O,1,I,L) */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a random room code
 */
export function generateRoomCode(): string {
	const array = new Uint8Array(6);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}
