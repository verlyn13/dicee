/**
 * Store No Circular Dependencies Invariant
 *
 * Detects circular dependencies between stores which can cause
 * initialization issues and infinite loops.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'store_no_circular_deps';
const INVARIANT_NAME = 'Store No Circular Dependencies';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'Stores should not have circular dependencies. Circular store dependencies can cause initialization issues, infinite loops, and make the code harder to reason about.',
		category: 'structural',
		severity: 'error',
		businessRule:
			'Store dependencies must form a DAG (directed acyclic graph) for predictable initialization.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Get all store nodes
		const storeNodes = engine.getNodesByType('Store');
		const storeIds = new Set(storeNodes.map((n) => n.id));

		// Find cycles in the graph
		const allCycles = engine.findCycles();

		// Filter to cycles that involve stores
		const storeCycles = allCycles.filter((cycle) => cycle.some((nodeId) => storeIds.has(nodeId)));

		// Create a violation for each store cycle
		for (const cycle of storeCycles) {
			// Get the stores involved in this cycle
			const storesInCycle = cycle.filter((nodeId) => storeIds.has(nodeId));

			if (storesInCycle.length < 2) continue;

			// Get the first store as the "source" for the violation
			const firstStoreId = storesInCycle[0];
			const firstStore = engine.getNode(firstStoreId);
			if (!firstStore) continue;

			// Build the cycle path string
			const cycleNames = cycle.map((id) => {
				const node = engine.getNode(id);
				return node?.name ?? id;
			});
			const cyclePath = [...cycleNames, cycleNames[0]].join(' → ');

			const violation = createViolation(
				INVARIANT_ID,
				INVARIANT_NAME,
				`Circular dependency detected: ${cyclePath}`,
				firstStoreId,
				'error',
			);

			violation.businessRule =
				'Store dependencies must form a DAG for predictable initialization order.';
			violation.suggestion =
				'Break the cycle by extracting shared logic into a service or using a different state management pattern.';

			// Add evidence from the stores' file locations
			violation.evidence = storesInCycle
				.map((nodeId) => {
					const node = engine.getNode(nodeId);
					if (node?.filePath) {
						return {
							filePath: node.filePath,
							line: node.attributes.startLine ?? 1,
						};
					}
					return null;
				})
				.filter((e): e is NonNullable<typeof e> => e !== null);

			violation.context = {
				cycleNodes: cycle,
				storesInvolved: storesInCycle,
			};

			violations.push(violation);
		}

		return violations;
	},
);
