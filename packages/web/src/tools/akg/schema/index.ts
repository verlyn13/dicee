/**
 * AKG Schema Exports
 *
 * Re-exports all schema definitions for the Architectural Knowledge Graph.
 */

// Config schemas
export {
	AKGConfig,
	CIConfig,
	// Type utilities
	type DeepPartial,
	DiscoveryConfig,
	// Constants
	defaultConfig,
	InvariantOverride,
	InvariantsConfig,
	// Schemas
	LayerDefinition,
	// Utilities
	mergeWithDefaults,
	OutputConfig,
	safeValidateConfig,
	validateConfig,
} from './config.schema.js';
// Graph schemas
export {
	type AdjacencyEntry,
	type AdjacencyList,
	AKGEdge,
	AKGGraph,
	AKGNode,
	buildAdjacencyList,
	buildNodeMap,
	ComponentClassification,
	Confidence,
	// Factory functions
	createEmptyGraph,
	createMetadata,
	DiscoveryMethod,
	EdgeAttributes,
	EdgeEvidence,
	EdgeType,
	ExportDefinition,
	ExportKind,
	GraphMetadata,
	generateEdgeId,
	generateNodeId,
	// Schemas
	Metadata,
	NodeAttributes,
	// Helper types
	type NodeMap,
	// Enums and types
	NodeType,
	Severity,
} from './graph.schema.js';
// Invariant schemas
export {
	// Interface
	type AKGQueryEngine,
	aggregateCounts,
	CheckSummary,
	CheckSummaryCounts,
	calculateExitCode,
	// Factory functions
	createCheckSummary,
	createViolation,
	ExitCode,
	// Enums
	InvariantCategory,
	type InvariantCheckFn,
	InvariantCheckResult,
	InvariantDefinition,
	// Schemas
	InvariantMeta,
	InvariantViolation,
	ViolationEvidence,
} from './invariant.schema.js';
