/**
 * Room Identity Validation Schemas
 *
 * Zod 4 runtime validation schemas for room identity data.
 * Ensures cartridge properties are valid before rendering.
 *
 * @example
 * import { RoomIdentitySchema, parseRoomIdentity } from '@dicee/shared';
 *
 * const result = parseRoomIdentity(rawData);
 * if (result.success) {
 *   // result.data is typed as RoomIdentity
 * }
 */

import { z } from 'zod';
import { CARTRIDGE_COLORS, CARTRIDGE_PATTERNS } from '../types/room-identity.js';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Cartridge color enum validation
 * Maps to --cartridge-{color} CSS variables
 */
export const CartridgeColorSchema = z.enum(CARTRIDGE_COLORS);

/**
 * Cartridge pattern enum validation
 * Maps to .cartridge-pattern-{pattern} CSS classes
 */
export const CartridgePatternSchema = z.enum(CARTRIDGE_PATTERNS);

// =============================================================================
// Room Identity Schema
// =============================================================================

/**
 * Full room identity validation schema
 * Validates procedurally generated identity stored with RoomInfo
 */
export const RoomIdentitySchema = z.object({
	hypeName: z
		.string()
		.min(3, { error: 'Hype name must be at least 3 characters' })
		.max(30, { error: 'Hype name must be at most 30 characters' }),
	color: CartridgeColorSchema,
	pattern: CartridgePatternSchema,
	baseRotation: z
		.number()
		.min(-1, { error: 'Base rotation must be at least -1' })
		.max(1, { error: 'Base rotation must be at most 1' }),
});

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a room identity object
 * Returns SafeParseReturnType with typed success/error
 */
export function parseRoomIdentity(input: unknown) {
	return RoomIdentitySchema.safeParse(input);
}

/**
 * Check if a value is a valid room identity
 * Type guard for unknown data
 */
export function isValidRoomIdentity(input: unknown): boolean {
	return RoomIdentitySchema.safeParse(input).success;
}
