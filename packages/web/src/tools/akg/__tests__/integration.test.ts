/**
 * AKG Integration Tests
 *
 * End-to-end tests for the AKG schema infrastructure.
 * Tests the full workflow: config loading → graph creation → serialization.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultConfig, getDiscoveryPatterns, loadConfig } from '../config/index.js';
import {
	type AKGEdge,
	AKGGraph,
	type AKGNode,
	buildAdjacencyList,
	buildNodeMap,
	createEmptyGraph,
	createMetadata,
	generateEdgeId,
	generateNodeId,
} from '../schema/graph.schema.js';
import {
	aggregateCounts,
	CheckSummary,
	calculateExitCode,
	createCheckSummary,
	createViolation,
	type InvariantCheckResult,
} from '../schema/invariant.schema.js';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;

beforeEach(async () => {
	testDir = join(tmpdir(), `akg-integration-${Date.now()}`);
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	try {
		await rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// =============================================================================
// Config → Graph Integration
// =============================================================================

describe('Config to Graph Integration', () => {
	it('should load config and create graph with correct project root', async () => {
		const configPath = join(testDir, 'akg.config.json');
		await writeFile(
			configPath,
			JSON.stringify({
				project: 'integration-test',
				discovery: {
					include: ['src/**/*.ts'],
					exclude: ['**/*.test.ts'],
					tsconfig: 'tsconfig.json',
				},
			}),
		);

		const config = await loadConfig(configPath);
		const graph = createEmptyGraph(testDir);

		expect(config.project).toBe('integration-test');
		expect(graph.projectRoot).toBe(testDir);
		expect(graph.nodes).toHaveLength(0);
		expect(graph.edges).toHaveLength(0);
	});

	it('should use discovery patterns from config', async () => {
		const config = await loadConfig(undefined, testDir);
		const patterns = getDiscoveryPatterns(config);

		expect(patterns.include.length).toBeGreaterThan(0);
		expect(patterns.exclude).toContain('**/*.test.ts');
	});
});

// =============================================================================
// Graph Serialization Integration
// =============================================================================

describe('Graph Serialization Integration', () => {
	it('should serialize and deserialize graph', async () => {
		// Create a graph with nodes and edges
		const graph = createEmptyGraph(testDir);
		const _now = new Date().toISOString();

		const nodeA: AKGNode = {
			id: generateNodeId('Component', 'Die', 'src/components/Die.svelte'),
			type: 'Component',
			name: 'Die',
			filePath: 'src/components/Die.svelte',
			attributes: {
				layer: 'components',
				classification: 'dumb',
			},
			metadata: createMetadata(),
		};

		const nodeB: AKGNode = {
			id: generateNodeId('Store', 'diceStore', 'src/stores/dice.svelte.ts'),
			type: 'Store',
			name: 'diceStore',
			filePath: 'src/stores/dice.svelte.ts',
			attributes: {
				layer: 'stores',
				isExported: true,
			},
			metadata: createMetadata(),
		};

		const edge: AKGEdge = {
			id: generateEdgeId('imports', nodeA.id, nodeB.id),
			type: 'imports',
			sourceNodeId: nodeA.id,
			targetNodeId: nodeB.id,
			attributes: {
				importedNames: ['diceStore'],
			},
			evidence: [
				{
					filePath: 'src/components/Die.svelte',
					line: 5,
					snippet: "import { diceStore } from '../stores/dice.svelte';",
				},
			],
			metadata: createMetadata(),
		};

		graph.nodes = [nodeA, nodeB];
		graph.edges = [edge];
		graph.metadata.totalFiles = 2;

		// Serialize to JSON
		const serialized = JSON.stringify(graph, null, '\t');
		const graphPath = join(testDir, 'graph.json');
		await writeFile(graphPath, serialized);

		// Read and deserialize
		const content = await readFile(graphPath, 'utf-8');
		const deserialized = JSON.parse(content);

		// Validate against schema
		const validated = AKGGraph.parse(deserialized);

		expect(validated.nodes).toHaveLength(2);
		expect(validated.edges).toHaveLength(1);
		expect(validated.nodes[0].name).toBe('Die');
		expect(validated.edges[0].type).toBe('imports');
	});

	it('should build data structures for traversal', () => {
		const graph = createEmptyGraph(testDir);

		const nodeA: AKGNode = {
			id: 'a',
			type: 'Module',
			name: 'A',
			attributes: {},
			metadata: createMetadata(),
		};

		const nodeB: AKGNode = {
			id: 'b',
			type: 'Module',
			name: 'B',
			attributes: {},
			metadata: createMetadata(),
		};

		const nodeC: AKGNode = {
			id: 'c',
			type: 'Module',
			name: 'C',
			attributes: {},
			metadata: createMetadata(),
		};

		const edgeAB: AKGEdge = {
			id: 'ab',
			type: 'imports',
			sourceNodeId: 'a',
			targetNodeId: 'b',
			attributes: {},
			evidence: [],
			metadata: createMetadata(),
		};

		const edgeBC: AKGEdge = {
			id: 'bc',
			type: 'imports',
			sourceNodeId: 'b',
			targetNodeId: 'c',
			attributes: {},
			evidence: [],
			metadata: createMetadata(),
		};

		graph.nodes = [nodeA, nodeB, nodeC];
		graph.edges = [edgeAB, edgeBC];

		// Build data structures
		const nodeMap = buildNodeMap(graph);
		const adjacency = buildAdjacencyList(graph);

		// Verify node map
		expect(nodeMap.size).toBe(3);
		expect(nodeMap.get('a')?.name).toBe('A');
		expect(nodeMap.get('b')?.name).toBe('B');

		// Verify adjacency list
		expect(adjacency.get('a')?.outgoing).toHaveLength(1);
		expect(adjacency.get('a')?.incoming).toHaveLength(0);
		expect(adjacency.get('b')?.outgoing).toHaveLength(1);
		expect(adjacency.get('b')?.incoming).toHaveLength(1);
		expect(adjacency.get('c')?.outgoing).toHaveLength(0);
		expect(adjacency.get('c')?.incoming).toHaveLength(1);
	});
});

// =============================================================================
// Invariant Check Integration
// =============================================================================

describe('Invariant Check Integration', () => {
	it('should create check summary and aggregate results', () => {
		const summary = createCheckSummary('1.0.0');

		// Simulate check results
		const passingResult: InvariantCheckResult = {
			invariantId: 'no_cycles',
			passed: true,
			violations: [],
			durationMs: 50,
			nodesChecked: 100,
			edgesChecked: 150,
		};

		const failingResult: InvariantCheckResult = {
			invariantId: 'layer_violation',
			passed: false,
			violations: [
				createViolation(
					'layer_violation',
					'Layer Violation',
					'Component imports store directly',
					'component::Die::abc',
					'error',
				),
				createViolation(
					'layer_violation',
					'Layer Violation',
					'Service imports route',
					'service::auth::def',
					'warning',
				),
			],
			durationMs: 75,
			nodesChecked: 100,
			edgesChecked: 150,
		};

		summary.results = [passingResult, failingResult];
		summary.totalDurationMs = 125;

		// Aggregate counts
		const counts = aggregateCounts(summary.results);
		expect(counts.totalInvariants).toBe(2);
		expect(counts.passed).toBe(1);
		expect(counts.failed).toBe(1);
		expect(counts.errors).toBe(1);
		expect(counts.warnings).toBe(1);

		// Calculate exit code
		const exitCode = calculateExitCode(summary.results);
		expect(exitCode).toBe('errors');

		// Update summary
		summary.summary = counts;
		summary.exitCode = exitCode;

		// Validate against schema
		expect(() => CheckSummary.parse(summary)).not.toThrow();
	});

	it('should serialize check summary to JSON', async () => {
		const summary = createCheckSummary('1.0.0');
		summary.results = [
			{
				invariantId: 'test',
				passed: true,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 3,
			},
		];
		summary.summary = aggregateCounts(summary.results);
		summary.exitCode = calculateExitCode(summary.results);

		// Serialize
		const serialized = JSON.stringify(summary, null, '\t');
		const summaryPath = join(testDir, 'check-summary.json');
		await writeFile(summaryPath, serialized);

		// Read and validate
		const content = await readFile(summaryPath, 'utf-8');
		const deserialized = JSON.parse(content);
		const validated = CheckSummary.parse(deserialized);

		expect(validated.exitCode).toBe('success');
		expect(validated.results).toHaveLength(1);
	});
});

// =============================================================================
// Full Workflow Integration
// =============================================================================

describe('Full AKG Workflow', () => {
	it('should complete config → graph → check workflow', async () => {
		// 1. Load config
		const configPath = join(testDir, 'akg.config.json');
		await writeFile(
			configPath,
			JSON.stringify({
				project: 'workflow-test',
				layers: [
					{
						name: 'components',
						paths: ['src/components/**'],
						mayNotImport: ['stores'],
					},
					{
						name: 'stores',
						paths: ['src/stores/**'],
					},
				],
				ci: {
					failOnError: true,
					failOnWarning: false,
					sarif: false,
				},
			}),
		);

		const config = await loadConfig(configPath);
		expect(config.project).toBe('workflow-test');
		expect(config.layers).toHaveLength(2);

		// 2. Create graph
		const graph = createEmptyGraph(testDir);
		graph.nodes = [
			{
				id: 'component::Widget',
				type: 'Component',
				name: 'Widget',
				filePath: 'src/components/Widget.svelte',
				attributes: { layer: 'components' },
				metadata: createMetadata(),
			},
			{
				id: 'store::appStore',
				type: 'Store',
				name: 'appStore',
				filePath: 'src/stores/app.svelte.ts',
				attributes: { layer: 'stores' },
				metadata: createMetadata(),
			},
		];

		// Add a violation edge (component imports store, which is forbidden)
		graph.edges = [
			{
				id: 'imports::Widget->appStore',
				type: 'imports',
				sourceNodeId: 'component::Widget',
				targetNodeId: 'store::appStore',
				attributes: {},
				evidence: [{ filePath: 'src/components/Widget.svelte', line: 3 }],
				metadata: createMetadata(),
			},
		];
		graph.metadata.totalFiles = 2;

		// Validate graph
		expect(() => AKGGraph.parse(graph)).not.toThrow();

		// 3. Simulate invariant check (would be real in discovery engine)
		const checkSummary = createCheckSummary(graph.version);

		// Check would detect layer violation
		const violation = createViolation(
			'layer_violation',
			'Layer Violation',
			'Component "Widget" imports from forbidden layer "stores"',
			'component::Widget',
			'error',
		);
		violation.targetNode = 'store::appStore';
		violation.evidence = [{ filePath: 'src/components/Widget.svelte', line: 3 }];
		violation.businessRule = 'Components may not import stores directly';

		checkSummary.results = [
			{
				invariantId: 'layer_violation',
				passed: false,
				violations: [violation],
				durationMs: 50,
				nodesChecked: 2,
				edgesChecked: 1,
			},
		];
		checkSummary.totalDurationMs = 50;
		checkSummary.summary = aggregateCounts(checkSummary.results);
		checkSummary.exitCode = calculateExitCode(checkSummary.results);

		// 4. Verify results match CI config
		const shouldFail = config.ci?.failOnError && checkSummary.exitCode === 'errors';
		expect(shouldFail).toBe(true);

		// 5. Serialize outputs
		const graphPath = join(testDir, 'graph.json');
		const checkPath = join(testDir, 'check-summary.json');

		await writeFile(graphPath, JSON.stringify(graph, null, '\t'));
		await writeFile(checkPath, JSON.stringify(checkSummary, null, '\t'));

		// 6. Verify files are valid
		const graphContent = await readFile(graphPath, 'utf-8');
		const checkContent = await readFile(checkPath, 'utf-8');

		expect(() => AKGGraph.parse(JSON.parse(graphContent))).not.toThrow();
		expect(() => CheckSummary.parse(JSON.parse(checkContent))).not.toThrow();
	});
});

// =============================================================================
// Default Config Validation
// =============================================================================

describe('Default Config Structure', () => {
	it('should have correct Dicee layer configuration', () => {
		const layers = defaultConfig.layers ?? [];

		// Verify all expected layers exist
		const layerNames = layers.map((l) => l.name);
		expect(layerNames).toContain('routes');
		expect(layerNames).toContain('components');
		expect(layerNames).toContain('stores');
		expect(layerNames).toContain('services');
		expect(layerNames).toContain('types');
		expect(layerNames).toContain('supabase');
		expect(layerNames).toContain('wasm');

		// Verify layer rules
		const componentsLayer = layers.find((l) => l.name === 'components');
		expect(componentsLayer?.mayNotImport).toContain('stores');
		expect(componentsLayer?.mayNotImport).toContain('services');

		const storesLayer = layers.find((l) => l.name === 'stores');
		expect(storesLayer?.mayNotImport).toContain('components');
		expect(storesLayer?.mayNotImport).toContain('routes');
	});

	it('should have valid discovery patterns', () => {
		const discovery = defaultConfig.discovery;

		expect(discovery?.include).toContain('packages/web/src/**/*.ts');
		expect(discovery?.include).toContain('packages/web/src/**/*.svelte');
		expect(discovery?.exclude).toContain('**/*.test.ts');
		expect(discovery?.exclude).toContain('**/node_modules/**');
	});
});
