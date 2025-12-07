/**
 * AKG Cycle Detection
 *
 * Implements Tarjan's algorithm for finding strongly connected components (SCCs).
 * Cycles are SCCs with more than one node, or single nodes with self-loops.
 */

import type { AdjacencyList, AKGNode } from '../schema/graph.schema.js';

/**
 * Find all cycles in the graph using Tarjan's algorithm
 *
 * Returns strongly connected components that represent cycles.
 * Single-node SCCs without self-loops are excluded.
 *
 * @param nodes - All nodes in the graph
 * @param adjacencyList - Graph adjacency list
 * @returns Array of cycles, each cycle is an array of node IDs
 */
export function findAllCycles(nodes: AKGNode[], adjacencyList: AdjacencyList): string[][] {
	const sccs = findStronglyConnectedComponents(nodes, adjacencyList);

	// Filter to only include actual cycles:
	// - SCCs with more than one node
	// - Single-node SCCs with self-loops
	return sccs.filter((scc) => {
		if (scc.length > 1) {
			return true;
		}
		// Check for self-loop
		if (scc.length === 1) {
			const nodeId = scc[0];
			const entry = adjacencyList.get(nodeId);
			if (entry) {
				return entry.outgoing.some((e) => e.targetNodeId === nodeId);
			}
		}
		return false;
	});
}

/**
 * Tarjan's algorithm for finding strongly connected components
 *
 * Time complexity: O(V + E)
 * Space complexity: O(V)
 *
 * @param nodes - All nodes in the graph
 * @param adjacencyList - Graph adjacency list
 * @returns Array of SCCs, each SCC is an array of node IDs
 */
export function findStronglyConnectedComponents(
	nodes: AKGNode[],
	adjacencyList: AdjacencyList,
): string[][] {
	let index = 0;
	const stack: string[] = [];
	const onStack = new Set<string>();
	const indices = new Map<string, number>();
	const lowLinks = new Map<string, number>();
	const sccs: string[][] = [];

	function strongConnect(nodeId: string): void {
		// Set the depth index for this node
		indices.set(nodeId, index);
		lowLinks.set(nodeId, index);
		index++;
		stack.push(nodeId);
		onStack.add(nodeId);

		// Consider successors
		const entry = adjacencyList.get(nodeId);
		if (entry) {
			for (const edge of entry.outgoing) {
				const targetId = edge.targetNodeId;

				if (!indices.has(targetId)) {
					// Successor not yet visited; recurse
					strongConnect(targetId);
					// biome-ignore lint/style/noNonNullAssertion: Tarjan's algorithm invariant - values set at function start
					lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!));
				} else if (onStack.has(targetId)) {
					// Successor is on stack, so it's in the current SCC
					// biome-ignore lint/style/noNonNullAssertion: Tarjan's algorithm invariant - indices set before recursion
					lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(targetId)!));
				}
			}
		}

		// If this is a root node, pop the stack and generate an SCC
		if (lowLinks.get(nodeId) === indices.get(nodeId)) {
			const scc: string[] = [];
			let w: string;
			do {
				// biome-ignore lint/style/noNonNullAssertion: Stack always has elements when in SCC root
				w = stack.pop()!;
				onStack.delete(w);
				scc.push(w);
			} while (w !== nodeId);
			sccs.push(scc);
		}
	}

	// Visit all nodes
	for (const node of nodes) {
		if (!indices.has(node.id)) {
			strongConnect(node.id);
		}
	}

	return sccs;
}

/**
 * Find all simple cycles (elementary circuits) in the graph
 *
 * Uses Johnson's algorithm which is more efficient for finding
 * all elementary circuits than naive DFS.
 *
 * Warning: Can be expensive for graphs with many cycles.
 * Use maxCycles limit for safety.
 *
 * @param adjacencyList - Graph adjacency list
 * @param maxCycles - Maximum number of cycles to find (default 1000)
 * @returns Array of cycles, each cycle is an array of node IDs in cycle order
 */
export function findSimpleCycles(
	adjacencyList: AdjacencyList,
	maxCycles: number = 1000,
): string[][] {
	const cycles: string[][] = [];
	const blocked = new Set<string>();
	const blockedMap = new Map<string, Set<string>>();
	const stack: string[] = [];
	const nodeIds = [...adjacencyList.keys()];

	function unblock(nodeId: string): void {
		blocked.delete(nodeId);
		const blockedNodes = blockedMap.get(nodeId);
		if (blockedNodes) {
			for (const w of blockedNodes) {
				if (blocked.has(w)) {
					unblock(w);
				}
			}
			blockedNodes.clear();
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Johnson's algorithm inherently complex
	function circuit(nodeId: string, startId: string, subgraph: Set<string>): boolean {
		if (cycles.length >= maxCycles) return false;

		let foundCycle = false;
		stack.push(nodeId);
		blocked.add(nodeId);

		const entry = adjacencyList.get(nodeId);
		if (entry) {
			for (const edge of entry.outgoing) {
				const targetId = edge.targetNodeId;

				if (!subgraph.has(targetId)) continue;

				if (targetId === startId) {
					// Found a cycle
					cycles.push([...stack]);
					foundCycle = true;
					if (cycles.length >= maxCycles) break;
				} else if (!blocked.has(targetId)) {
					if (circuit(targetId, startId, subgraph)) {
						foundCycle = true;
					}
				}
			}
		}

		if (foundCycle) {
			unblock(nodeId);
		} else {
			const entry = adjacencyList.get(nodeId);
			if (entry) {
				for (const edge of entry.outgoing) {
					const targetId = edge.targetNodeId;
					if (subgraph.has(targetId)) {
						if (!blockedMap.has(targetId)) {
							blockedMap.set(targetId, new Set());
						}
						blockedMap.get(targetId)?.add(nodeId);
					}
				}
			}
		}

		stack.pop();
		return foundCycle;
	}

	// For each node as starting point
	for (let i = 0; i < nodeIds.length && cycles.length < maxCycles; i++) {
		const startId = nodeIds[i];
		// Build subgraph of nodes with index >= i
		const subgraph = new Set(nodeIds.slice(i));

		blocked.clear();
		blockedMap.clear();

		circuit(startId, startId, subgraph);
	}

	return cycles;
}

/**
 * Check if the graph contains any cycles
 *
 * More efficient than finding all cycles if you only need to know
 * whether cycles exist.
 *
 * @param adjacencyList - Graph adjacency list
 * @returns true if the graph contains at least one cycle
 */
export function hasCycles(adjacencyList: AdjacencyList): boolean {
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function dfs(nodeId: string): boolean {
		if (visiting.has(nodeId)) {
			return true; // Cycle found
		}
		if (visited.has(nodeId)) {
			return false;
		}

		visiting.add(nodeId);

		const entry = adjacencyList.get(nodeId);
		if (entry) {
			for (const edge of entry.outgoing) {
				if (dfs(edge.targetNodeId)) {
					return true;
				}
			}
		}

		visiting.delete(nodeId);
		visited.add(nodeId);
		return false;
	}

	for (const nodeId of adjacencyList.keys()) {
		if (!visited.has(nodeId)) {
			if (dfs(nodeId)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Get cycle information with paths
 *
 * @param cycles - Array of cycles from findAllCycles
 * @param adjacencyList - Graph adjacency list
 * @returns Cycles with edge information
 */
export interface CycleInfo {
	nodeIds: string[];
	edges: Array<{ from: string; to: string; type: string }>;
}

export function getCycleInfo(cycles: string[][], adjacencyList: AdjacencyList): CycleInfo[] {
	return cycles.map((cycle) => {
		const edges: Array<{ from: string; to: string; type: string }> = [];

		for (let i = 0; i < cycle.length; i++) {
			const from = cycle[i];
			const to = cycle[(i + 1) % cycle.length];

			const entry = adjacencyList.get(from);
			if (entry) {
				const edge = entry.outgoing.find((e) => e.targetNodeId === to);
				if (edge) {
					edges.push({ from, to, type: edge.type });
				}
			}
		}

		return { nodeIds: cycle, edges };
	});
}
