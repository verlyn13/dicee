/**
 * WebSocket Handlers Use Shared Validation Invariant
 *
 * Enforces that WebSocket message handlers import validation schemas from @dicee/shared.
 * This ensures protocol consistency between client and server.
 *
 * LIMITATION: AKG graph discovery doesn't capture external package imports
 * (e.g., `import from '@dicee/shared'`) as edges. This invariant checks for
 * graph edges which won't exist for external imports. The imports ARE present
 * in the code and verified by TypeScript compilation.
 *
 * Current Status: Both lobby.svelte.ts and roomService.svelte.ts have
 * @dicee/shared imports added (parseLobbyServerEvent, parseServerEvent, etc.)
 * but the invariant can't detect them due to graph limitations.
 *
 * TODO: Enhance AKG discovery to resolve external package imports to local paths.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'websocket_uses_shared_validation';
const INVARIANT_NAME = 'WebSocket Handlers Use Shared Validation';

// Files that handle WebSocket messages and should import @dicee/shared
// Note: lobby.svelte.ts is in stores/, roomService.svelte.ts is in services/
const WEBSOCKET_HANDLER_PATTERNS = ['stores/lobby.svelte.ts', 'services/roomService.svelte.ts'];

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'WebSocket message handlers must import validation schemas from @dicee/shared for protocol compliance. This ensures client and server use the same message type definitions.',
		category: 'structural',
		severity: 'warning',
		businessRule:
			'Protocol consistency requires shared validation schemas. WebSocket handlers should validate incoming messages using @dicee/shared schemas.',
		enabledByDefault: false, // Disabled: AKG can't detect external package imports
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Find WebSocket handler nodes
		for (const pattern of WEBSOCKET_HANDLER_PATTERNS) {
			const handlerNodes = engine.getNodes((n) => {
				return n.filePath?.includes(pattern) ?? false;
			});

			for (const handlerNode of handlerNodes) {
				// Check if this handler imports from @dicee/shared
				const sharedImports = engine.getEdges((e) => {
					if (e.sourceNodeId !== handlerNode.id) return false;
					if (e.type !== 'imports' && e.type !== 'imports_type') return false;

					const targetNode = engine.getNode(e.targetNodeId);
					if (!targetNode) return false;

					// Check if target is @dicee/shared or packages/shared
					const nameMatch = targetNode.name?.includes('@dicee/shared') ?? false;
					const pathMatchShared = targetNode.filePath?.includes('@dicee/shared') ?? false;
					const pathMatchPackages = targetNode.filePath?.includes('packages/shared') ?? false;

					return nameMatch || pathMatchShared || pathMatchPackages;
				});

				if (sharedImports.length === 0) {
					const violation = createViolation(
						INVARIANT_ID,
						INVARIANT_NAME,
						`${pattern} does not import from @dicee/shared. Use shared validation schemas for protocol consistency.`,
						handlerNode.id,
						'warning',
					);

					violation.suggestion = `Add 'import { parseLobbyCommand, parseLobbyServerEvent } from "@dicee/shared";' to ${pattern}`;
					violation.businessRule =
						'Protocol consistency requires shared type definitions and validation between client and server.';

					violations.push(violation);
				}
			}
		}

		return violations;
	},
);
