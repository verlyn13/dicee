/**
 * WASM Single Entry Point Invariant
 *
 * Enforces that only engine.ts imports from the WASM module.
 * All other code should go through the engine.ts bridge.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'wasm_single_entry';
const INVARIANT_NAME = 'WASM Single Entry Point';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'Only engine.ts should import from the WASM module. All other code must use the engine.ts bridge to ensure proper initialization and type safety.',
		category: 'structural',
		severity: 'error',
		businessRule:
			'WASM bindings are internal implementation details and should not leak to consumers.',
		enabledByDefault: true,
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Find all import edges that target WASM-related nodes
		const wasmImportEdges = engine.getEdges((e) => {
			if (e.type !== 'imports' && e.type !== 'imports_type') {
				return false;
			}

			const targetNode = engine.getNode(e.targetNodeId);
			if (!targetNode) return false;

			// Check if target is in wasm/ directory or is a WASMModule type
			const isWasmTarget =
				targetNode.type === 'WASMModule' ||
				(targetNode.filePath !== undefined && targetNode.filePath.includes('/wasm/'));

			return isWasmTarget;
		});

		// Check each WASM import
		for (const edge of wasmImportEdges) {
			const sourceNode = engine.getNode(edge.sourceNodeId);
			if (!sourceNode) continue;

			// Allow engine.ts to import from WASM
			const isEngineBridge =
				sourceNode.type === 'WASMBridge' || sourceNode.filePath?.endsWith('/engine.ts');

			if (!isEngineBridge) {
				const violation = createViolation(
					INVARIANT_ID,
					INVARIANT_NAME,
					`'${sourceNode.name}' imports WASM directly. Use engine.ts bridge instead.`,
					sourceNode.id,
					'error',
				);

				// Add evidence
				if (edge.evidence.length > 0) {
					violation.evidence = edge.evidence.map((e) => ({
						filePath: e.filePath,
						line: e.line,
						column: e.column,
						snippet: e.snippet,
					}));
				}

				violation.targetNode = edge.targetNodeId;
				violation.businessRule =
					'WASM bindings should only be accessed through the engine.ts bridge for proper initialization and type safety.';
				violation.suggestion =
					'Import from $lib/engine.ts instead of directly from the wasm/ directory.';

				violations.push(violation);
			}
		}

		return violations;
	},
);
