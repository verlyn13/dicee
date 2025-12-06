/**
 * Layer Component Isolation Invariant
 *
 * Enforces that "dumb" components don't import stores or services directly.
 * Only "smart" containers should connect to state management.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'layer_component_isolation';
const INVARIANT_NAME = 'Component Layer Isolation';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'Dumb components should not import stores or services directly. Only smart containers should connect UI to state management.',
		category: 'structural',
		severity: 'warning',
		businessRule:
			'Maintain separation of concerns: dumb components receive data via props, smart containers handle state.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Get all component nodes classified as "dumb" or "unknown"
		const dumbComponents = engine.getNodes((n) => {
			if (n.type !== 'Component') return false;
			const classification = n.attributes.classification;
			// Only check components that are explicitly dumb or haven't been classified
			return classification === 'dumb' || classification === 'unknown';
		});

		// Get store and service node IDs for checking
		const storeIds = new Set(engine.getNodesByType('Store').map((n) => n.id));
		const serviceIds = new Set(engine.getNodesByType('Service').map((n) => n.id));

		for (const component of dumbComponents) {
			const outgoingEdges = engine.getOutgoing(component.id);

			for (const edge of outgoingEdges) {
				// Only check import edges
				if (edge.type !== 'imports' && edge.type !== 'imports_type') {
					continue;
				}

				const targetNode = engine.getNode(edge.targetNodeId);
				if (!targetNode) continue;

				// Check if importing a store
				if (storeIds.has(edge.targetNodeId) || targetNode.type === 'Store') {
					const violation = createViolation(
						INVARIANT_ID,
						INVARIANT_NAME,
						`Component '${component.name}' imports store '${targetNode.name}' directly. Use props instead.`,
						component.id,
						'warning',
					);

					violation.targetNode = edge.targetNodeId;
					violation.businessRule =
						'Dumb components should receive data via props, not import stores directly.';
					violation.suggestion = `Pass ${targetNode.name} data as props from a parent smart container.`;

					if (edge.evidence.length > 0) {
						violation.evidence = edge.evidence.map((e) => ({
							filePath: e.filePath,
							line: e.line,
							column: e.column,
							snippet: e.snippet,
						}));
					}

					violations.push(violation);
				}

				// Check if importing a service
				if (serviceIds.has(edge.targetNodeId) || targetNode.type === 'Service') {
					const violation = createViolation(
						INVARIANT_ID,
						INVARIANT_NAME,
						`Component '${component.name}' imports service '${targetNode.name}' directly. Use callback props instead.`,
						component.id,
						'warning',
					);

					violation.targetNode = edge.targetNodeId;
					violation.businessRule =
						'Dumb components should use callback props for actions, not import services directly.';
					violation.suggestion = `Pass ${targetNode.name} methods as callback props (e.g., onAction) from a parent smart container.`;

					if (edge.evidence.length > 0) {
						violation.evidence = edge.evidence.map((e) => ({
							filePath: e.filePath,
							line: e.line,
							column: e.column,
							snippet: e.snippet,
						}));
					}

					violations.push(violation);
				}
			}
		}

		return violations;
	},
);
