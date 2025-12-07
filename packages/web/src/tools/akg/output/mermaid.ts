/**
 * Mermaid Output for AKG
 *
 * Generates Mermaid diagrams from the AKG graph for architectural visualization.
 * Outputs both Markdown (for humans/GitHub) and JSON sidecar (for agent queries).
 *
 * @see docs/architecture/akg/RFC_MERMAID_VISUALIZATION.md
 */

import { createHash } from 'node:crypto';
import { createQueryEngine, type QueryEngine } from '../query/engine.js';
import type { AKGConfig, LayerDefinition } from '../schema/config.schema.js';
import type { AKGGraph, AKGNode } from '../schema/graph.schema.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported diagram types
 */
export type DiagramType =
	| 'layer_architecture'
	| 'store_dependencies'
	| 'component_dependencies'
	| 'dataflow';

/**
 * Generated diagram result
 */
export interface DiagramResult {
	type: DiagramType;
	markdown: string;
	json: DiagramJson;
	hash: string;
}

/**
 * JSON sidecar format for diagram
 */
export interface DiagramJson {
	$schema: string;
	version: string;
	diagramType: DiagramType;
	generatedAt: string;
	graphHash: string;
	sourceCommit?: string;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
	metadata: DiagramMetadata;
}

/**
 * Node in diagram JSON
 */
export interface DiagramNode {
	id: string;
	label: string;
	nodeCount?: number;
	layer?: string;
	type?: string;
}

/**
 * Edge in diagram JSON
 */
export interface DiagramEdge {
	from: string;
	to: string;
	type: 'allowed_import' | 'forbidden_import' | 'imports' | 'derives_from';
}

/**
 * Diagram metadata
 */
export interface DiagramMetadata {
	totalNodes: number;
	totalEdges: number;
	invariantsChecked?: number;
	violationCount?: number;
}

/**
 * Options for diagram generation
 */
export interface MermaidOptions {
	/** Git commit hash for attribution */
	sourceCommit?: string;
	/** Git branch name */
	sourceBranch?: string;
	/** Maximum nodes per diagram (default: 30) */
	maxNodes?: number;
	/** Include layer rules in output */
	includeForbiddenImports?: boolean;
}

// =============================================================================
// Hash Generation
// =============================================================================

/**
 * Generate SHA256 hash of content
 */
export function generateHash(content: string): string {
	return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/**
 * Generate hash of AKG graph for staleness detection
 */
export function generateGraphHash(graph: AKGGraph): string {
	// Hash based on node IDs and edge relationships (stable representation)
	const nodeIds = graph.nodes.map((n) => n.id).sort();
	const edgeIds = graph.edges.map((e) => `${e.sourceNodeId}->${e.targetNodeId}`).sort();
	const content = JSON.stringify({ nodes: nodeIds, edges: edgeIds });
	return generateHash(content);
}

// =============================================================================
// Diagram Generators
// =============================================================================

/**
 * Generate layer architecture diagram
 */
export function generateLayerArchitecture(
	graph: AKGGraph,
	config: AKGConfig | null,
	options: MermaidOptions = {},
): DiagramResult {
	const engine = createQueryEngine(graph);
	const timestamp = new Date().toISOString();
	const graphHash = generateGraphHash(graph);

	// Get layer definitions from config
	const layers = config?.layers ?? [];
	const layerNodes: DiagramNode[] = [];
	const edges: DiagramEdge[] = [];

	// Build layer nodes with counts
	for (const layer of layers) {
		const nodesInLayer = engine.getNodesInLayer(layer.name);
		layerNodes.push({
			id: `layer::${layer.name}`,
			label: layer.name,
			nodeCount: nodesInLayer.length,
		});
	}

	// Build allowed import edges
	for (const layer of layers) {
		for (const target of layer.mayImport ?? []) {
			edges.push({
				from: `layer::${layer.name}`,
				to: `layer::${target}`,
				type: 'allowed_import',
			});
		}

		// Optionally include forbidden imports
		if (options.includeForbiddenImports) {
			for (const target of layer.mayNotImport ?? []) {
				edges.push({
					from: `layer::${layer.name}`,
					to: `layer::${target}`,
					type: 'forbidden_import',
				});
			}
		}
	}

	// Generate Mermaid diagram
	const mermaid = generateLayerMermaid(layers, engine);

	// Generate forbidden imports table
	const forbiddenTable = generateForbiddenImportsTable(layers);

	// Build markdown output
	const markdown = `<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Dicee Layer Architecture

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: ${options.sourceCommit ?? 'unknown'}
> Generated: ${timestamp}

## Overview

The Dicee architecture enforces a strict layered dependency model with ${layers.length} layers
and ${graph.nodes.filter((n) => n.type !== 'Layer' && n.type !== 'Package').length} code nodes.

## Layer Dependency Diagram

\`\`\`mermaid
${mermaid}
\`\`\`

## Forbidden Dependencies

${forbiddenTable}

## Invariant Status

See \`pnpm akg:check\` for current invariant status.
`;

	// Build JSON sidecar
	const json: DiagramJson = {
		$schema: 'https://dicee.jefahnierocks.com/schemas/akg-diagram.json',
		version: '1.0.0',
		diagramType: 'layer_architecture',
		generatedAt: timestamp,
		graphHash,
		sourceCommit: options.sourceCommit,
		nodes: layerNodes,
		edges,
		metadata: {
			totalNodes: layerNodes.length,
			totalEdges: edges.length,
		},
	};

	return {
		type: 'layer_architecture',
		markdown,
		json,
		hash: generateHash(markdown),
	};
}

/**
 * Generate Mermaid flowchart for layers
 */
function generateLayerMermaid(layers: LayerDefinition[], engine: QueryEngine): string {
	const lines: string[] = ['flowchart TB'];
	lines.push('    subgraph "Dicee Architecture"');

	// Define layer nodes with icons and counts
	const layerIcons: Record<string, string> = {
		routes: '🛣️',
		components: '🧩',
		stores: '🗄️',
		services: '⚙️',
		types: '📝',
		supabase: '🔌',
		wasm: '🦀',
	};

	for (const layer of layers) {
		const count = engine.getNodesInLayer(layer.name).length;
		const icon = layerIcons[layer.name] ?? '📦';
		const nodeId = sanitizeId(layer.name);
		lines.push(`        ${nodeId}["${icon} ${layer.name} (${count})"]`);
	}

	lines.push('    end');
	lines.push('');

	// Add allowed import edges
	for (const layer of layers) {
		const fromId = sanitizeId(layer.name);
		for (const target of layer.mayImport ?? []) {
			const toId = sanitizeId(target);
			lines.push(`    ${fromId} --> ${toId}`);
		}
	}

	return lines.join('\n');
}

/**
 * Generate forbidden imports table
 */
function generateForbiddenImportsTable(layers: LayerDefinition[]): string {
	const lines: string[] = [
		'| From | May NOT Import | Invariant |',
		'|------|---------------|-----------|',
	];

	for (const layer of layers) {
		const forbidden = layer.mayNotImport ?? [];
		if (forbidden.length > 0) {
			lines.push(`| ${layer.name} | ${forbidden.join(', ')} | layer isolation |`);
		}
	}

	return lines.join('\n');
}

/**
 * Generate store dependencies diagram
 */
export function generateStoreDependencies(
	graph: AKGGraph,
	_config: AKGConfig | null,
	options: MermaidOptions = {},
): DiagramResult {
	const engine = createQueryEngine(graph);
	const timestamp = new Date().toISOString();
	const graphHash = generateGraphHash(graph);
	const maxNodes = options.maxNodes ?? 30;

	// Get store nodes
	const stores = engine.getNodesByType('Store').slice(0, maxNodes);
	const diagramNodes: DiagramNode[] = [];
	const edges: DiagramEdge[] = [];

	// Build diagram nodes
	for (const store of stores) {
		diagramNodes.push({
			id: store.id,
			label: store.name.replace(/\.svelte\.ts$/, ''),
			type: 'Store',
			layer: store.attributes.layer,
		});
	}

	// Find store-to-store edges
	const storeIds = new Set(stores.map((s) => s.id));
	for (const store of stores) {
		const outgoing = engine.getOutgoing(store.id);
		for (const edge of outgoing) {
			if (storeIds.has(edge.targetNodeId)) {
				edges.push({
					from: store.id,
					to: edge.targetNodeId,
					type: edge.type === 'derives_from' ? 'derives_from' : 'imports',
				});
			}
		}
	}

	// Generate Mermaid
	const mermaid = generateStoreMermaid(stores, edges, engine);

	const markdown = `<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Store Dependencies

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: ${options.sourceCommit ?? 'unknown'}
> Generated: ${timestamp}

## Store Dependency Diagram

Shows how Svelte stores depend on each other.

\`\`\`mermaid
${mermaid}
\`\`\`

## Store List

${stores.map((s) => `- **${s.name.replace(/\.svelte\.ts$/, '')}**: \`${s.filePath}\``).join('\n')}
`;

	const json: DiagramJson = {
		$schema: 'https://dicee.jefahnierocks.com/schemas/akg-diagram.json',
		version: '1.0.0',
		diagramType: 'store_dependencies',
		generatedAt: timestamp,
		graphHash,
		sourceCommit: options.sourceCommit,
		nodes: diagramNodes,
		edges,
		metadata: {
			totalNodes: diagramNodes.length,
			totalEdges: edges.length,
		},
	};

	return {
		type: 'store_dependencies',
		markdown,
		json,
		hash: generateHash(markdown),
	};
}

/**
 * Generate Mermaid for store dependencies
 */
function generateStoreMermaid(
	stores: AKGNode[],
	edges: DiagramEdge[],
	_engine: QueryEngine,
): string {
	const lines: string[] = ['flowchart LR'];

	// Add store nodes (cylinder shape for stores)
	for (const store of stores) {
		const shortName = store.name.replace(/\.svelte\.ts$/, '');
		const nodeId = sanitizeId(store.id);
		lines.push(`    ${nodeId}[("${shortName}")]`);
	}

	lines.push('');

	// Add edges
	for (const edge of edges) {
		const fromId = sanitizeId(edge.from);
		const toId = sanitizeId(edge.to);
		const style = edge.type === 'derives_from' ? '-.->|derives|' : '-->';
		lines.push(`    ${fromId} ${style} ${toId}`);
	}

	return lines.join('\n');
}

/**
 * Generate component dependencies diagram
 */
export function generateComponentDependencies(
	graph: AKGGraph,
	_config: AKGConfig | null,
	options: MermaidOptions = {},
): DiagramResult {
	const engine = createQueryEngine(graph);
	const timestamp = new Date().toISOString();
	const graphHash = generateGraphHash(graph);
	const maxNodes = options.maxNodes ?? 30;

	// Get component nodes
	const components = engine.getNodesByType('Component').slice(0, maxNodes);
	const diagramNodes: DiagramNode[] = [];
	const edges: DiagramEdge[] = [];

	// Build diagram nodes
	for (const comp of components) {
		diagramNodes.push({
			id: comp.id,
			label: comp.name.replace(/\.svelte$/, ''),
			type: 'Component',
			layer: comp.attributes.layer,
		});
	}

	// Find component-to-component edges
	const componentIds = new Set(components.map((c) => c.id));
	for (const comp of components) {
		const outgoing = engine.getOutgoing(comp.id);
		for (const edge of outgoing) {
			if (componentIds.has(edge.targetNodeId) && edge.type === 'uses_component') {
				edges.push({
					from: comp.id,
					to: edge.targetNodeId,
					type: 'imports',
				});
			}
		}
	}

	// Generate Mermaid
	const mermaid = generateComponentMermaid(components, edges);

	const markdown = `<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Component Dependencies

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: ${options.sourceCommit ?? 'unknown'}
> Generated: ${timestamp}

## Component Dependency Diagram

Shows how Svelte components use each other.

\`\`\`mermaid
${mermaid}
\`\`\`

## Component List (showing ${components.length} of ${engine.getNodesByType('Component').length})

${components.map((c) => `- **${c.name.replace(/\.svelte$/, '')}**: \`${c.filePath}\``).join('\n')}
`;

	const json: DiagramJson = {
		$schema: 'https://dicee.jefahnierocks.com/schemas/akg-diagram.json',
		version: '1.0.0',
		diagramType: 'component_dependencies',
		generatedAt: timestamp,
		graphHash,
		sourceCommit: options.sourceCommit,
		nodes: diagramNodes,
		edges,
		metadata: {
			totalNodes: diagramNodes.length,
			totalEdges: edges.length,
		},
	};

	return {
		type: 'component_dependencies',
		markdown,
		json,
		hash: generateHash(markdown),
	};
}

/**
 * Generate Mermaid for component dependencies
 */
function generateComponentMermaid(components: AKGNode[], edges: DiagramEdge[]): string {
	const lines: string[] = ['flowchart LR'];

	// Add component nodes
	for (const comp of components) {
		const shortName = comp.name.replace(/\.svelte$/, '');
		const nodeId = sanitizeId(comp.id);
		lines.push(`    ${nodeId}["${shortName}"]`);
	}

	lines.push('');

	// Add edges
	for (const edge of edges) {
		const fromId = sanitizeId(edge.from);
		const toId = sanitizeId(edge.to);
		lines.push(`    ${fromId} --> ${toId}`);
	}

	return lines.join('\n');
}

/**
 * Generate all standard diagrams
 */
export function generateAllDiagrams(
	graph: AKGGraph,
	config: AKGConfig | null,
	options: MermaidOptions = {},
): DiagramResult[] {
	return [
		generateLayerArchitecture(graph, config, options),
		generateStoreDependencies(graph, config, options),
		generateComponentDependencies(graph, config, options),
	];
}

// =============================================================================
// Verification
// =============================================================================

/**
 * Verify a diagram's hash matches its content
 */
export function verifyDiagramHash(markdown: string, expectedHash: string): boolean {
	const actualHash = generateHash(markdown);
	return actualHash === expectedHash;
}

/**
 * Check if diagrams are stale relative to graph
 */
export function checkStaleness(
	existingJson: DiagramJson,
	currentGraph: AKGGraph,
): { stale: boolean; reason?: string } {
	const currentGraphHash = generateGraphHash(currentGraph);
	if (existingJson.graphHash !== currentGraphHash) {
		return {
			stale: true,
			reason: `Graph hash mismatch: expected ${existingJson.graphHash}, got ${currentGraphHash}`,
		};
	}
	return { stale: false };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Sanitize node ID for Mermaid (alphanumeric + underscore only)
 */
function sanitizeId(id: string): string {
	return id.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
}

/**
 * Get diagram filename from type
 */
export function getDiagramFilename(type: DiagramType): string {
	const names: Record<DiagramType, string> = {
		layer_architecture: 'LAYER_ARCHITECTURE',
		store_dependencies: 'STORE_DEPENDENCIES',
		component_dependencies: 'COMPONENT_DEPENDENCIES',
		dataflow: 'DATAFLOW',
	};
	return names[type];
}
