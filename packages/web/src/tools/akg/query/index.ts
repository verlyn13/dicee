/**
 * AKG Query Module
 *
 * Provides graph querying, traversal, and cycle detection capabilities.
 */

export type { CycleInfo } from './cycles.js';
// Cycle detection
export {
	findAllCycles,
	findSimpleCycles,
	findStronglyConnectedComponents,
	getCycleInfo,
	hasCycles,
} from './cycles.js';
export type { GraphStats } from './engine.js';
// Query engine
export { createQueryEngine, QueryEngine } from './engine.js';
// Traversal utilities
export {
	bfsTraversal,
	dfsTraversal,
	findAllPaths,
	findShortestPath,
	getMaxDepth,
	getReachableNodes,
	topologicalSort,
} from './traversal.js';
