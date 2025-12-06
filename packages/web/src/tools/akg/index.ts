/**
 * Architectural Knowledge Graph (AKG)
 *
 * Static architectural analysis for Dicee codebase.
 * Provides graph-based invariant checking and dependency analysis.
 *
 * @see docs/architecture/akg/PRE_AKG_PLANNING.md
 * @see docs/architecture/akg/WEEK_1_2_SCHEMA_INFRASTRUCTURE.md
 */

// Re-export config utilities
export * from './config/index.js';
// Re-export discovery utilities
export * from './discovery/index.js';
// Re-export all schemas
export * from './schema/index.js';

// Version
export const AKG_VERSION = '1.0.0';
