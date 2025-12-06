/**
 * Service Layer Boundaries Invariant
 *
 * Enforces that services don't import from layers they shouldn't depend on.
 * Services should be independent of UI concerns.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'service_layer_boundaries';
const INVARIANT_NAME = 'Service Layer Boundaries';

// Layers that services should NOT import from
const FORBIDDEN_LAYERS = ['components', 'routes'];
const FORBIDDEN_TYPES = ['Component', 'SmartContainer', 'Route', 'Layout'];

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'Services should not import from UI layers (components, routes). Services must remain independent of presentation concerns.',
		category: 'structural',
		severity: 'error',
		businessRule:
			'Services are reusable business logic that should not depend on UI implementation details.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Get all service nodes
		const serviceNodes = engine.getNodesByType('Service');

		for (const service of serviceNodes) {
			const outgoingEdges = engine.getOutgoing(service.id);

			for (const edge of outgoingEdges) {
				// Only check import edges
				if (edge.type !== 'imports' && edge.type !== 'imports_type') {
					continue;
				}

				const targetNode = engine.getNode(edge.targetNodeId);
				if (!targetNode) continue;

				// Check if target is in a forbidden layer
				const targetLayer = targetNode.attributes.layer;
				const isInForbiddenLayer = targetLayer && FORBIDDEN_LAYERS.includes(targetLayer);

				// Check if target is a forbidden type
				const isForbiddenType = FORBIDDEN_TYPES.includes(targetNode.type);

				if (isInForbiddenLayer || isForbiddenType) {
					const reason = isInForbiddenLayer
						? `in the '${targetLayer}' layer`
						: `a ${targetNode.type}`;

					const violation = createViolation(
						INVARIANT_ID,
						INVARIANT_NAME,
						`Service '${service.name}' imports '${targetNode.name}' which is ${reason}. Services should not depend on UI.`,
						service.id,
						'error',
					);

					violation.targetNode = edge.targetNodeId;
					violation.businessRule =
						'Services must be reusable and independent of presentation layer.';
					violation.suggestion =
						'Move shared logic to a separate utility module, or lift the dependency to a store or route that composes both.';

					if (edge.evidence.length > 0) {
						violation.evidence = edge.evidence.map((e) => ({
							filePath: e.filePath,
							line: e.line,
							column: e.column,
							snippet: e.snippet,
						}));
					}

					violation.context = {
						targetLayer,
						targetType: targetNode.type,
					};

					violations.push(violation);
				}
			}
		}

		return violations;
	},
);
