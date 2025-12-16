/**
 * Room Identity Generator
 *
 * Procedurally generates room identity from room code.
 * Uses MurmurHash3-inspired hash for better distribution on short strings.
 */

import type { RoomIdentity, CartridgeColor, CartridgePattern } from '../types/room-identity.js';

// =============================================================================
// Hype Name Dictionaries
// =============================================================================

/**
 * Curated adjectives for hype names
 *
 * Requirements:
 * - Short length (4-6 chars preferred) to prevent overflow
 * - Industrial/Digital/Brutal theme alignment
 * - Grammatical sense in Adjective + Noun pattern
 */
const ADJECTIVES = [
	// Energy tier
	'HYPER',
	'TURBO',
	'MEGA',
	'GIGA',
	'ULTRA',
	'PRIMAL',
	'SAVAGE',
	'ATOMIC',
	// Digital tier
	'CYBER',
	'NEON',
	'PIXEL',
	'GLITCH',
	'BINARY',
	'LOGIC',
	'QUANTUM',
	'VECTOR',
	// Physical tier
	'RUSTY',
	'SOLID',
	'HEAVY',
	'ROUGH',
	'RAW',
	'RIGID',
	'IRON',
	'CHROME',
	// Vibe tier
	'LUCKY',
	'TOXIC',
	'WILD',
	'GRIM',
	'PURE',
	'VOID',
	'STARK',
	'BOLD',
] as const;

/**
 * Curated nouns for hype names
 */
const NOUNS = [
	// Spaces
	'ZONE',
	'PIT',
	'GRID',
	'VAULT',
	'LOBBY',
	'WARD',
	'DEN',
	'HUB',
	// Structures
	'TOWER',
	'BASE',
	'BUNKER',
	'BLOCK',
	'DECK',
	'UNIT',
	'CAGE',
	'DOCK',
	// Abstract
	'NEXUS',
	'CORE',
	'NODE',
	'GATE',
	'PORT',
	'LOOP',
	'FLUX',
	'AXIS',
	// Activity
	'ARENA',
	'LAB',
	'CLUB',
	'HAVEN',
	'SITE',
	'YARD',
	'FORGE',
	'MILL',
] as const;

/**
 * Colors without 'concrete' (weighted for more vibrant results)
 */
const WEIGHTED_COLORS: CartridgeColor[] = [
	'flamingo',
	'mint',
	'sky',
	'orchid',
	'sherbet',
	'slime',
	'coral',
	'teal',
	'lavender',
	'peach',
	'sage',
	'plum',
	// 'concrete' excluded for more vibrant defaults
];

/**
 * Patterns weighted toward 'none' for visual rest (50% solid)
 */
const WEIGHTED_PATTERNS: CartridgePattern[] = [
	'none',
	'none',
	'none', // Weight "none" at 50%
	'hazard',
	'dots',
	'grid',
];

// =============================================================================
// Hash Function
// =============================================================================

/**
 * MurmurHash3-inspired hash for better distribution on short strings
 *
 * Standard charCode hashing has poor avalanche properties for 6-char room codes.
 * This provides much better distribution for palette selection.
 *
 * @param str - Input string to hash
 * @returns Unsigned 32-bit integer hash
 */
export function stableHash(str: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;

	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}

	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// =============================================================================
// Generator Function
// =============================================================================

/**
 * Generate a deterministic room identity from a room code
 *
 * IMPORTANT: This should be called ONCE at room creation.
 * The result is persisted in RoomInfo.identity.
 *
 * @param roomCode - 6-character room code (e.g., "FFDVNG")
 * @returns Complete room identity for persistence
 */
export function generateRoomIdentity(roomCode: string): RoomIdentity {
	const hash = stableHash(roomCode.toUpperCase());

	// Use different bits of the hash for different properties
	// This ensures properties are independently distributed
	const adjIndex = hash % ADJECTIVES.length;
	const nounIndex = Math.floor(hash / ADJECTIVES.length) % NOUNS.length;
	const colorIndex = Math.floor(hash / (ADJECTIVES.length * NOUNS.length)) % WEIGHTED_COLORS.length;
	const patternIndex =
		Math.floor(hash / (ADJECTIVES.length * NOUNS.length * WEIGHTED_COLORS.length)) % WEIGHTED_PATTERNS.length;

	// Rotation is subtle: -0.7 to +0.7 degrees
	const rotationSeed = (hash % 100) / 100;
	const baseRotation = (rotationSeed - 0.5) * 1.4; // Range: -0.7 to +0.7

	return {
		hypeName: `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`,
		color: WEIGHTED_COLORS[colorIndex],
		pattern: WEIGHTED_PATTERNS[patternIndex],
		baseRotation: Math.round(baseRotation * 100) / 100, // Round to 2 decimals
	};
}

// =============================================================================
// CSS Utility Functions
// =============================================================================

/**
 * Get CSS variable name for a cartridge color
 *
 * @param color - Cartridge color key
 * @returns CSS variable reference string
 */
export function getColorVar(color: CartridgeColor): string {
	return `var(--cartridge-${color})`;
}

/**
 * Get CSS class name for a pattern
 *
 * @param pattern - Cartridge pattern key
 * @returns CSS class name (empty string for 'none')
 */
export function getPatternClass(pattern: CartridgePattern): string {
	return pattern === 'none' ? '' : `cartridge-pattern-${pattern}`;
}
