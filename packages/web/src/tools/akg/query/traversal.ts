/**
 * AKG Graph Traversal Utilities
 *
 * Provides BFS and DFS traversal algorithms for the graph.
 */

import type { AdjacencyList } from '../schema/graph.schema.js';

/**
 * Find shortest path between two nodes using BFS
 *
 * @param from - Source node ID
 * @param to - Target node ID
 * @param adjacencyList - Graph adjacency list
 * @returns Array of node IDs from source to target, or null if no path exists
 */
export function findShortestPath(
	from: string,
	to: string,
	adjacencyList: AdjacencyList,
): string[] | null {
	if (from === to) {
		return [from];
	}

	const visited = new Set<string>();
	const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: from, path: [from] }];

	visited.add(from);

	while (queue.length > 0) {
		const current = queue.shift()!;
		const entry = adjacencyList.get(current.nodeId);

		if (!entry) continue;

		for (const edge of entry.outgoing) {
			const targetId = edge.targetNodeId;

			if (targetId === to) {
				return [...current.path, targetId];
			}

			if (!visited.has(targetId)) {
				visited.add(targetId);
				queue.push({
					nodeId: targetId,
					path: [...current.path, targetId],
				});
			}
		}
	}

	return null;
}

/**
 * Find all paths between two nodes using DFS
 *
 * Warning: Can be expensive for large graphs with many paths.
 * Use with maxPaths limit for safety.
 *
 * @param from - Source node ID
 * @param to - Target node ID
 * @param adjacencyList - Graph adjacency list
 * @param maxPaths - Maximum number of paths to find (default 100)
 * @returns Array of paths, each path is an array of node IDs
 */
export function findAllPaths(
	from: string,
	to: string,
	adjacencyList: AdjacencyList,
	maxPaths: number = 100,
): string[][] {
	const paths: string[][] = [];
	const visited = new Set<string>();

	function dfs(current: string, path: string[]): void {
		if (paths.length >= maxPaths) return;

		if (current === to) {
			paths.push([...path]);
			return;
		}

		visited.add(current);
		const entry = adjacencyList.get(current);

		if (entry) {
			for (const edge of entry.outgoing) {
				if (!visited.has(edge.targetNodeId)) {
					path.push(edge.targetNodeId);
					dfs(edge.targetNodeId, path);
					path.pop();
				}
			}
		}

		visited.delete(current);
	}

	dfs(from, [from]);
	return paths;
}

/**
 * Perform BFS traversal from a starting node
 *
 * @param startId - Starting node ID
 * @param adjacencyList - Graph adjacency list
 * @param visitor - Callback for each visited node, return false to stop
 * @param direction - Follow outgoing or incoming edges
 */
export function bfsTraversal(
	startId: string,
	adjacencyList: AdjacencyList,
	visitor: (nodeId: string, depth: number) => boolean | undefined,
	direction: 'outgoing' | 'incoming' = 'outgoing',
): void {
	const visited = new Set<string>();
	const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startId, depth: 0 }];

	visited.add(startId);

	while (queue.length > 0) {
		const { nodeId, depth } = queue.shift()!;

		const shouldContinue = visitor(nodeId, depth);
		if (shouldContinue === false) return;

		const entry = adjacencyList.get(nodeId);
		if (!entry) continue;

		const edges = direction === 'outgoing' ? entry.outgoing : entry.incoming;
		for (const edge of edges) {
			const nextId = direction === 'outgoing' ? edge.targetNodeId : edge.sourceNodeId;

			if (!visited.has(nextId)) {
				visited.add(nextId);
				queue.push({ nodeId: nextId, depth: depth + 1 });
			}
		}
	}
}

/**
 * Perform DFS traversal from a starting node
 *
 * @param startId - Starting node ID
 * @param adjacencyList - Graph adjacency list
 * @param visitor - Callback for each visited node, return false to stop
 * @param direction - Follow outgoing or incoming edges
 */
export function dfsTraversal(
	startId: string,
	adjacencyList: AdjacencyList,
	visitor: (nodeId: string, depth: number) => boolean | undefined,
	direction: 'outgoing' | 'incoming' = 'outgoing',
): void {
	const visited = new Set<string>();

	function dfs(nodeId: string, depth: number): boolean {
		if (visited.has(nodeId)) return true;
		visited.add(nodeId);

		const shouldContinue = visitor(nodeId, depth);
		if (shouldContinue === false) return false;

		const entry = adjacencyList.get(nodeId);
		if (!entry) return true;

		const edges = direction === 'outgoing' ? entry.outgoing : entry.incoming;
		for (const edge of edges) {
			const nextId = direction === 'outgoing' ? edge.targetNodeId : edge.sourceNodeId;
			if (!dfs(nextId, depth + 1)) return false;
		}

		return true;
	}

	dfs(startId, 0);
}

/**
 * Get all reachable nodes from a starting node
 *
 * @param startId - Starting node ID
 * @param adjacencyList - Graph adjacency list
 * @param direction - Follow outgoing or incoming edges
 * @returns Set of reachable node IDs (excluding start)
 */
export function getReachableNodes(
	startId: string,
	adjacencyList: AdjacencyList,
	direction: 'outgoing' | 'incoming' = 'outgoing',
): Set<string> {
	const reachable = new Set<string>();

	bfsTraversal(
		startId,
		adjacencyList,
		(nodeId) => {
			if (nodeId !== startId) {
				reachable.add(nodeId);
			}
			return undefined;
		},
		direction,
	);

	return reachable;
}

/**
 * Calculate the depth of the dependency tree from a node
 *
 * @param startId - Starting node ID
 * @param adjacencyList - Graph adjacency list
 * @param direction - Follow outgoing or incoming edges
 * @returns Maximum depth reached
 */
export function getMaxDepth(
	startId: string,
	adjacencyList: AdjacencyList,
	direction: 'outgoing' | 'incoming' = 'outgoing',
): number {
	let maxDepth = 0;

	bfsTraversal(
		startId,
		adjacencyList,
		(_nodeId, depth) => {
			maxDepth = Math.max(maxDepth, depth);
			return undefined;
		},
		direction,
	);

	return maxDepth;
}

/**
 * Topological sort of the graph
 *
 * @param adjacencyList - Graph adjacency list
 * @returns Array of node IDs in topological order, or null if graph has cycles
 */
export function topologicalSort(adjacencyList: AdjacencyList): string[] | null {
	const visited = new Set<string>();
	const visiting = new Set<string>(); // For cycle detection
	const result: string[] = [];

	function visit(nodeId: string): boolean {
		if (visiting.has(nodeId)) {
			return false; // Cycle detected
		}
		if (visited.has(nodeId)) {
			return true;
		}

		visiting.add(nodeId);

		const entry = adjacencyList.get(nodeId);
		if (entry) {
			for (const edge of entry.outgoing) {
				if (!visit(edge.targetNodeId)) {
					return false;
				}
			}
		}

		visiting.delete(nodeId);
		visited.add(nodeId);
		result.unshift(nodeId);
		return true;
	}

	for (const nodeId of adjacencyList.keys()) {
		if (!visited.has(nodeId)) {
			if (!visit(nodeId)) {
				return null; // Graph has cycles
			}
		}
	}

	return result;
}
