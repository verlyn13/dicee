/**
 * Dice Types
 *
 * Core dice-related types for Dicee multiplayer game.
 * These are the canonical definitions - all packages import from here.
 */

/** Array of 5 dice values (1-6) */
export type DiceArray = [number, number, number, number, number];

/** Mask indicating which dice are kept (true = kept) */
export type KeptMask = [boolean, boolean, boolean, boolean, boolean];

/** Valid dice value (1-6) */
export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

/** Dice index (0-4) */
export type DiceIndex = 0 | 1 | 2 | 3 | 4;

/** Number of dice in a roll */
export const DICE_COUNT = 5 as const;

/** Maximum rolls per turn */
export const MAX_ROLLS_PER_TURN = 3 as const;

/** Roll number (1, 2, or 3) */
export type RollNumber = 1 | 2 | 3;

/** Rolls remaining (0, 1, or 2) */
export type RollsRemaining = 0 | 1 | 2;
