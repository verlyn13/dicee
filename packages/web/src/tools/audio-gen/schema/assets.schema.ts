/**
 * Audio Asset Schemas
 *
 * Zod 4 schemas for audio asset definitions and generation manifest.
 * Aligned with audio-plan.md structure and static/audio/ output paths.
 */

import { z } from 'zod';

// =============================================================================
// Asset Categories (from audio-plan.md)
// =============================================================================

/**
 * Audio asset category - maps to directory structure
 */
export const AssetCategorySchema = z.enum([
	'dice', // sfx/dice/
	'ui', // sfx/ui/
	'score', // sfx/score/
	'music', // music/
	'ambient', // ambient/
]);

export type AssetCategory = z.infer<typeof AssetCategorySchema>;

/**
 * Production phase for prioritization
 */
export const ProductionPhaseSchema = z.enum([
	'mvp', // Phase 1: Ship first ($20 budget)
	'complete', // Phase 2: Post-validation ($30 budget)
	'future', // Phase 3+: Deferred
]);

export type ProductionPhase = z.infer<typeof ProductionPhaseSchema>;

/**
 * Audio format specification
 */
export const AudioFormatSchema = z.enum([
	'ogg', // Primary: OGG Vorbis
	'mp3', // Fallback: MP3 for Safari
]);

export type AudioFormat = z.infer<typeof AudioFormatSchema>;

// =============================================================================
// Asset Definition Schema
// =============================================================================

/**
 * Single audio asset definition
 */
export const AudioAssetSchema = z.object({
	/** Unique asset identifier (e.g., MVP-01, PHY-02) */
	id: z.string().regex(/^[A-Z]{2,4}-\d{2}$/, { error: 'Asset ID must be format: XXX-00' }),

	/** Output filename without extension */
	filename: z.string().regex(/^[a-z][a-z0-9_]*$/, { error: 'Filename must be snake_case' }),

	/** Asset category for directory placement */
	category: AssetCategorySchema,

	/** Production phase for prioritization */
	phase: ProductionPhaseSchema,

	/** Human-readable description */
	description: z.string().min(1).max(500),

	/** AI generation prompt for ElevenLabs */
	prompt: z.string().min(1).max(1000),

	/** Target duration in seconds */
	durationSeconds: z.number().min(0.1).max(60).optional(),

	/** Whether this should loop seamlessly */
	looping: z.boolean().optional(),

	/** Prompt influence level */
	promptInfluence: z.enum(['high', 'low']).optional(),

	/** Channels: mono for SFX, stereo for music/ambient */
	channels: z.enum(['mono', 'stereo']).optional(),

	/** Whether to preload in audio service */
	preload: z.boolean().optional(),

	/** Default volume (0-1) */
	defaultVolume: z.number().min(0).max(1).optional(),

	/** Variants to generate (for randomization) */
	variants: z.number().int().min(1).max(5).optional(),

	/** Post-processing notes */
	postProcessing: z.string().optional(),
});

export type AudioAsset = z.infer<typeof AudioAssetSchema>;

// =============================================================================
// Generation Manifest Schema
// =============================================================================

/**
 * Generation status for tracking
 */
export const GenerationStatusSchema = z.enum([
	'pending', // Not yet generated
	'generating', // Currently generating
	'generated', // Raw audio generated
	'processed', // Post-processing complete
	'verified', // Quality verified
	'failed', // Generation failed
]);

export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

/**
 * Generation result for a single asset
 */
export const GenerationResultSchema = z.object({
	/** Asset ID */
	assetId: z.string(),

	/** Current status */
	status: GenerationStatusSchema,

	/** Timestamp of last status change */
	timestamp: z.string().datetime(),

	/** Generated file paths (relative to static/audio/) */
	files: z.array(z.string()).optional(),

	/** Error message if failed */
	error: z.string().optional(),

	/** ElevenLabs request ID for tracking */
	requestId: z.string().optional(),

	/** Generation cost in credits */
	creditsUsed: z.number().optional(),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;

/**
 * Full generation manifest
 */
export const GenerationManifestSchema = z.object({
	/** Schema version */
	version: z.literal('1.0.0'),

	/** Last updated timestamp */
	updatedAt: z.string().datetime(),

	/** Total credits used */
	totalCreditsUsed: z.number().default(0),

	/** Results by asset ID */
	results: z.record(z.string(), GenerationResultSchema),
});

export type GenerationManifest = z.infer<typeof GenerationManifestSchema>;

// =============================================================================
// Asset Registry Schema
// =============================================================================

/**
 * Complete asset registry (all defined assets)
 */
export const AssetRegistrySchema = z.object({
	/** Schema version */
	version: z.literal('1.0.0'),

	/** Project name */
	project: z.literal('dicee'),

	/** All defined assets */
	assets: z.array(AudioAssetSchema),
});

export type AssetRegistry = z.infer<typeof AssetRegistrySchema>;

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the output directory for an asset category
 */
export function getCategoryPath(category: AssetCategory): string {
	switch (category) {
		case 'dice':
			return 'sfx/dice';
		case 'ui':
			return 'sfx/ui';
		case 'score':
			return 'sfx/score';
		case 'music':
			return 'music';
		case 'ambient':
			return 'ambient';
	}
}

/**
 * Get the full output path for an asset
 */
export function getAssetPath(
	asset: AudioAsset,
	format: AudioFormat = 'ogg',
	variant?: number,
): string {
	const dir = getCategoryPath(asset.category);
	const suffix = variant && variant > 1 ? `_alt${variant - 1}` : '';
	return `${dir}/${asset.filename}${suffix}.${format}`;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate an audio asset definition
 */
export function validateAsset(input: unknown) {
	return AudioAssetSchema.safeParse(input);
}

/**
 * Validate an asset registry
 */
export function validateRegistry(input: unknown) {
	return AssetRegistrySchema.safeParse(input);
}
