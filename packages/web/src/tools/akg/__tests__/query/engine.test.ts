/**
 * Query Engine Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createQueryEngine, type QueryEngine } from '../../query/engine.js';
import {
	type AKGEdge,
	type AKGGraph,
	type AKGNode,
	createEmptyGraph,
	createMetadata,
} from '../../schema/graph.schema.js';

describe('QueryEngine', () => {
	let graph: AKGGraph;
	let engine: QueryEngine;

	// Helper to create a test node
	const createNode = (
		id: string,
		type: AKGNode['type'],
		name: string,
		attrs: Partial<AKGNode['attributes']> = {},
	): AKGNode => ({
		id,
		type,
		name,
		filePath: `test/${name}.ts`,
		attributes: { layer: 'components', ...attrs },
		metadata: createMetadata(),
	});

	// Helper to create a test edge
	const createEdge = (
		id: string,
		type: AKGEdge['type'],
		sourceId: string,
		targetId: string,
	): AKGEdge => ({
		id,
		type,
		sourceNodeId: sourceId,
		targetNodeId: targetId,
		attributes: {},
		evidence: [],
		metadata: createMetadata(),
	});

	beforeEach(() => {
		graph = createEmptyGraph('/test');
		graph.nodes = [
			createNode('node-a', 'Component', 'ComponentA'),
			createNode('node-b', 'Component', 'ComponentB'),
			createNode('node-c', 'Store', 'StoreC', { layer: 'stores' }),
			createNode('node-d', 'Service', 'ServiceD', { layer: 'services' }),
		];
		graph.edges = [
			createEdge('edge-1', 'imports', 'node-a', 'node-b'),
			createEdge('edge-2', 'imports', 'node-a', 'node-c'),
			createEdge('edge-3', 'imports', 'node-b', 'node-d'),
		];
		engine = createQueryEngine(graph);
	});

	describe('getNode', () => {
		it('returns node by ID', () => {
			const node = engine.getNode('node-a');
			expect(node).toBeDefined();
			expect(node?.name).toBe('ComponentA');
		});

		it('returns undefined for non-existent ID', () => {
			const node = engine.getNode('non-existent');
			expect(node).toBeUndefined();
		});
	});

	describe('getNodes', () => {
		it('returns all nodes without filter', () => {
			const nodes = engine.getNodes();
			expect(nodes).toHaveLength(4);
		});

		it('filters nodes by predicate', () => {
			const stores = engine.getNodes((n) => n.type === 'Store');
			expect(stores).toHaveLength(1);
			expect(stores[0].name).toBe('StoreC');
		});
	});

	describe('getEdges', () => {
		it('returns all edges without filter', () => {
			const edges = engine.getEdges();
			expect(edges).toHaveLength(3);
		});

		it('filters edges by predicate', () => {
			const toStore = engine.getEdges((e) => e.targetNodeId === 'node-c');
			expect(toStore).toHaveLength(1);
		});
	});

	describe('getOutgoing', () => {
		it('returns outgoing edges from a node', () => {
			const outgoing = engine.getOutgoing('node-a');
			expect(outgoing).toHaveLength(2);
			expect(outgoing.map((e) => e.targetNodeId).sort()).toEqual(['node-b', 'node-c']);
		});

		it('returns empty array for node with no outgoing', () => {
			const outgoing = engine.getOutgoing('node-d');
			expect(outgoing).toHaveLength(0);
		});
	});

	describe('getIncoming', () => {
		it('returns incoming edges to a node', () => {
			const incoming = engine.getIncoming('node-b');
			expect(incoming).toHaveLength(1);
			expect(incoming[0].sourceNodeId).toBe('node-a');
		});

		it('returns empty array for node with no incoming', () => {
			const incoming = engine.getIncoming('node-a');
			expect(incoming).toHaveLength(0);
		});
	});

	describe('findPath', () => {
		it('finds direct path', () => {
			const path = engine.findPath('node-a', 'node-b');
			expect(path).toEqual(['node-a', 'node-b']);
		});

		it('finds transitive path', () => {
			const path = engine.findPath('node-a', 'node-d');
			expect(path).toEqual(['node-a', 'node-b', 'node-d']);
		});

		it('returns null for unreachable nodes', () => {
			const path = engine.findPath('node-d', 'node-a');
			expect(path).toBeNull();
		});

		it('returns single-node path for same source and target', () => {
			const path = engine.findPath('node-a', 'node-a');
			expect(path).toEqual(['node-a']);
		});
	});

	describe('getNodesByType', () => {
		it('returns nodes of a specific type', () => {
			const components = engine.getNodesByType('Component');
			expect(components).toHaveLength(2);
		});

		it('returns empty array for non-existent type', () => {
			const routes = engine.getNodesByType('Route');
			expect(routes).toHaveLength(0);
		});
	});

	describe('getNodesInLayer', () => {
		it('returns nodes in a specific layer', () => {
			const components = engine.getNodesInLayer('components');
			expect(components).toHaveLength(2);
		});

		it('returns empty array for non-existent layer', () => {
			const routes = engine.getNodesInLayer('routes');
			expect(routes).toHaveLength(0);
		});
	});

	describe('hasEdge', () => {
		it('returns true for existing edge', () => {
			expect(engine.hasEdge('node-a', 'node-b')).toBe(true);
		});

		it('returns false for non-existing edge', () => {
			expect(engine.hasEdge('node-a', 'node-d')).toBe(false);
		});
	});

	describe('isReachable', () => {
		it('returns true for reachable node', () => {
			expect(engine.isReachable('node-a', 'node-d')).toBe(true);
		});

		it('returns false for unreachable node', () => {
			expect(engine.isReachable('node-d', 'node-a')).toBe(false);
		});
	});

	describe('getDependencies', () => {
		it('returns all transitive dependencies', () => {
			const deps = engine.getDependencies('node-a');
			expect(deps).toHaveLength(3);
			expect(deps.map((n) => n.id).sort()).toEqual(['node-b', 'node-c', 'node-d']);
		});
	});

	describe('getDependents', () => {
		it('returns all transitive dependents', () => {
			const deps = engine.getDependents('node-d');
			expect(deps).toHaveLength(2);
			expect(deps.map((n) => n.id).sort()).toEqual(['node-a', 'node-b']);
		});
	});

	describe('getStats', () => {
		it('returns correct statistics', () => {
			const stats = engine.getStats();
			expect(stats.nodeCount).toBe(4);
			expect(stats.edgeCount).toBe(3);
			expect(stats.nodesByType.Component).toBe(2);
			expect(stats.nodesByType.Store).toBe(1);
			expect(stats.nodesByType.Service).toBe(1);
		});
	});
});

describe('QueryEngine - Cycle Detection', () => {
	it('detects simple cycles', () => {
		const graph = createEmptyGraph('/test');
		graph.nodes = [
			{
				id: 'a',
				type: 'Module',
				name: 'A',
				attributes: {},
				metadata: createMetadata(),
			},
			{
				id: 'b',
				type: 'Module',
				name: 'B',
				attributes: {},
				metadata: createMetadata(),
			},
			{
				id: 'c',
				type: 'Module',
				name: 'C',
				attributes: {},
				metadata: createMetadata(),
			},
		];
		graph.edges = [
			{
				id: 'e1',
				type: 'imports',
				sourceNodeId: 'a',
				targetNodeId: 'b',
				attributes: {},
				evidence: [],
				metadata: createMetadata(),
			},
			{
				id: 'e2',
				type: 'imports',
				sourceNodeId: 'b',
				targetNodeId: 'c',
				attributes: {},
				evidence: [],
				metadata: createMetadata(),
			},
			{
				id: 'e3',
				type: 'imports',
				sourceNodeId: 'c',
				targetNodeId: 'a',
				attributes: {},
				evidence: [],
				metadata: createMetadata(),
			},
		];

		const engine = createQueryEngine(graph);
		const cycles = engine.findCycles();

		expect(cycles.length).toBeGreaterThan(0);
		// The cycle should contain all three nodes
		const cycleNodes = new Set(cycles[0]);
		expect(cycleNodes.has('a')).toBe(true);
		expect(cycleNodes.has('b')).toBe(true);
		expect(cycleNodes.has('c')).toBe(true);
	});

	it('returns empty for acyclic graph', () => {
		const graph = createEmptyGraph('/test');
		graph.nodes = [
			{
				id: 'a',
				type: 'Module',
				name: 'A',
				attributes: {},
				metadata: createMetadata(),
			},
			{
				id: 'b',
				type: 'Module',
				name: 'B',
				attributes: {},
				metadata: createMetadata(),
			},
		];
		graph.edges = [
			{
				id: 'e1',
				type: 'imports',
				sourceNodeId: 'a',
				targetNodeId: 'b',
				attributes: {},
				evidence: [],
				metadata: createMetadata(),
			},
		];

		const engine = createQueryEngine(graph);
		const cycles = engine.findCycles();

		expect(cycles).toHaveLength(0);
	});
});
