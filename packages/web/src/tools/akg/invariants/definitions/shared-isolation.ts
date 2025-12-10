/**
 * Shared Package Isolation Invariant
 *
 * Ensures the shared package doesn't import from web or cloudflare-do packages.
 * The shared package should be a dependency-free foundation layer.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'shared_isolation';
const INVARIANT_NAME = 'Shared Package Isolation';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'The shared package (@dicee/shared) must not import from web or cloudflare-do packages. It should be a foundation layer with no reverse dependencies.',
		category: 'structural',
		severity: 'error',
		businessRule:
			'Shared types package is the foundation layer - importing from consumers would create circular dependencies.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Get all nodes in the shared package
		const sharedNodes = engine.getNodes((n) => {
			return n.filePath?.includes('packages/shared/') ?? false;
		});

		// Forbidden import targets (packages that depend on shared)
		const forbiddenPatterns = ['packages/web/', 'packages/cloudflare-do/'];

		for (const node of sharedNodes) {
			const outgoingEdges = engine.getOutgoing(node.id);

			for (const edge of outgoingEdges) {
				// Only check import edges
				if (
					edge.type !== 'imports' &&
					edge.type !== 'imports_type' &&
					edge.type !== 'dynamic_imports'
				) {
					continue;
				}

				const targetNode = engine.getNode(edge.targetNodeId);
				if (!targetNode?.filePath) continue;

				// Check if importing from a forbidden package
				const violatingPattern = forbiddenPatterns.find((pattern) =>
					targetNode.filePath?.includes(pattern),
				);

				if (violatingPattern) {
					const violation = createViolation(
						INVARIANT_ID,
						INVARIANT_NAME,
						`Shared package file '${node.name}' imports from '${targetNode.name}' (${violatingPattern}). This creates a circular dependency.`,
						node.id,
						'error',
					);

					violation.targetNode = edge.targetNodeId;
					violation.businessRule =
						'The shared package must not depend on packages that consume it (web, cloudflare-do).';
					violation.suggestion =
						'Move the required types/utilities to the shared package, or restructure to avoid the dependency.';

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
