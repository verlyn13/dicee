/**
 * Audio Generation Schema Exports
 *
 * Re-exports all schema definitions for the audio generation tool.
 */

// Asset definition schemas
export {
	// Types
	type AssetCategory,
	// Schemas
	AssetCategorySchema,
	type AssetRegistry,
	AssetRegistrySchema,
	type AudioAsset,
	AudioAssetSchema,
	type AudioFormat,
	AudioFormatSchema,
	type GenerationManifest,
	GenerationManifestSchema,
	type GenerationResult,
	GenerationResultSchema,
	type GenerationStatus,
	GenerationStatusSchema,
	// Path helpers
	getAssetPath,
	getCategoryPath,
	type ProductionPhase,
	ProductionPhaseSchema,
	// Validators
	validateAsset,
	validateRegistry,
} from './assets.schema.js';
// ElevenLabs API schemas
export {
	// Constants
	API_KEY_HEADER,
	// Types
	type ElevenLabsConfig,
	// Schemas
	ElevenLabsConfigSchema,
	type PromptInfluence,
	PromptInfluenceSchema,
	ResponseHeadersSchema,
	SOUND_EFFECTS_ENDPOINT,
	type SoundEffectRequest,
	SoundEffectRequestSchema,
	// Validators
	validateConfig,
	validateSoundEffectRequest,
} from './elevenlabs.schema.js';
