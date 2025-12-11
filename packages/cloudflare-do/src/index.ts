/**
 * @dicee/cloudflare-do
 *
 * Cloudflare Durable Objects for Dicee game.
 * Exports AI module for use by simulation package.
 */

// Re-export AI module for external consumption
export * from './ai/index.js';

// Re-export only the game TYPES that AI uses (not implementations that depend on Cloudflare)
export type {
	Category,
	DiceArray,
	KeptMask,
	Scorecard,
} from './game/types.js';
