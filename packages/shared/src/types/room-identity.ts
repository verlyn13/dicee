/**
 * Room Identity System
 *
 * Procedurally generated but persisted identity for game rooms.
 * Provides visual distinction and personality in the lobby.
 */

// =============================================================================
// Cartridge Color Types
// =============================================================================

/**
 * Available cartridge background colors (CSS variable names)
 * Each color has light and dark mode variants defined in cartridge-tokens.css
 */
export const CARTRIDGE_COLORS = [
	'flamingo',
	'mint',
	'sky',
	'orchid',
	'sherbet',
	'slime',
	'concrete',
	'coral',
	'teal',
	'lavender',
	'peach',
	'sage',
	'plum',
] as const;

export type CartridgeColor = (typeof CARTRIDGE_COLORS)[number];

// =============================================================================
// Cartridge Pattern Types
// =============================================================================

/**
 * Available pattern overlays
 * 'none' = solid color, others are CSS gradient-based patterns
 */
export const CARTRIDGE_PATTERNS = ['none', 'hazard', 'dots', 'grid', 'waves'] as const;

export type CartridgePattern = (typeof CARTRIDGE_PATTERNS)[number];

// =============================================================================
// Room Identity Interface
// =============================================================================

/**
 * Persisted room identity
 * Generated once at room creation, stored with RoomInfo
 */
export interface RoomIdentity {
	/**
	 * Display name (e.g., "TURBO NEXUS")
	 * Generated from adjective + noun word lists
	 */
	readonly hypeName: string;

	/**
	 * Background color key
	 * Maps to --cartridge-{color} CSS variable
	 */
	readonly color: CartridgeColor;

	/**
	 * Pattern overlay key
	 * 'none' = solid color, others add CSS gradient texture
	 */
	readonly pattern: CartridgePattern;

	/**
	 * Base rotation in degrees (-0.7 to +0.7)
	 * Alternates direction by position in stack for natural appearance
	 */
	readonly baseRotation: number;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid cartridge color
 */
export function isCartridgeColor(value: unknown): value is CartridgeColor {
	return typeof value === 'string' && CARTRIDGE_COLORS.includes(value as CartridgeColor);
}

/**
 * Check if a value is a valid cartridge pattern
 */
export function isCartridgePattern(value: unknown): value is CartridgePattern {
	return typeof value === 'string' && CARTRIDGE_PATTERNS.includes(value as CartridgePattern);
}
