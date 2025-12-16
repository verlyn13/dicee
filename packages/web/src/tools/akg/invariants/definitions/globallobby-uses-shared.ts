/**
 * GlobalLobby Uses Shared Schemas Invariant
 *
 * Enforces that GlobalLobby imports validation schemas from @dicee/shared.
 * This ensures protocol consistency between client and server.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'globallobby_uses_shared';
const INVARIANT_NAME = 'GlobalLobby Uses Shared Schemas';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'GlobalLobby must import validation schemas from @dicee/shared for protocol compliance. This ensures client and server use the same message type definitions.',
		category: 'structural',
		severity: 'warning',
		businessRule:
			'Protocol consistency requires single source of truth for message types. GlobalLobby should import from @dicee/shared, not define its own types.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Find GlobalLobby node
		const globalLobbyNode = engine.getNodes((n) => {
			return n.name === 'GlobalLobby' || (n.filePath?.includes('GlobalLobby.ts') ?? false);
		})[0];

		if (!globalLobbyNode) {
			// GlobalLobby not in graph (might be in different package not scanned)
			// This is expected since cloudflare-do is a separate package
			return [];
		}

		// Check if GlobalLobby imports from @dicee/shared
		const sharedImports = engine.getEdges((e) => {
			if (e.sourceNodeId !== globalLobbyNode.id) return false;
			if (e.type !== 'imports' && e.type !== 'imports_type') return false;

			const targetNode = engine.getNode(e.targetNodeId);
			if (!targetNode) return false;

			// Check if target is @dicee/shared
			const nameMatch = targetNode.name?.includes('@dicee/shared') ?? false;
			const pathMatchShared = targetNode.filePath?.includes('@dicee/shared') ?? false;
			const pathMatchPackages = targetNode.filePath?.includes('packages/shared') ?? false;

			return nameMatch || pathMatchShared || pathMatchPackages;
		});

		if (sharedImports.length === 0) {
			const violation = createViolation(
				INVARIANT_ID,
				INVARIANT_NAME,
				'GlobalLobby does not import from @dicee/shared. Use shared schemas for protocol consistency.',
				globalLobbyNode.id,
				'warning',
			);

			violation.suggestion =
				'Add \'import { parseLobbyCommand, LobbyCommandSchema } from "@dicee/shared";\' to GlobalLobby.ts';
			violation.businessRule =
				'Protocol consistency requires shared type definitions between client and server.';

			// Add evidence with file location for SARIF compliance
			if (globalLobbyNode.filePath) {
				violation.evidence.push({
					filePath: globalLobbyNode.filePath,
					line: 1, // Top of file where imports should be added
					column: 1,
				});
			}

			violations.push(violation);
		}

		return violations;
	},
);
