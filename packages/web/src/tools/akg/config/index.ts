/**
 * AKG Config Exports
 *
 * Re-exports config loading utilities.
 */

// Re-export schema types for convenience
export {
	type AKGConfig,
	type CIConfig,
	type DiscoveryConfig,
	defaultConfig,
	type InvariantOverride,
	type InvariantsConfig,
	type LayerDefinition,
	mergeWithDefaults,
	type OutputConfig,
	safeValidateConfig,
	validateConfig,
} from '../schema/config.schema.js';
export {
	// Constants
	CONFIG_FILE_NAMES,
	// Types
	type ConfigError,
	type ConfigLoadError,
	type ConfigLoadResult,
	type ConfigResult,
	// Functions
	findAndLoadConfig,
	generateDefaultConfig,
	getDiscoveryPatterns,
	getProjectName,
	loadConfig,
	loadConfigFromPath,
	SUPPORTED_EXTENSIONS,
} from './loader.js';
