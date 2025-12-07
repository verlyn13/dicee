/**
 * Store File Naming Invariant
 *
 * Enforces that store files use the .svelte.ts extension.
 * This is required for Svelte 5 runes to work correctly.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'store_file_naming';
const INVARIANT_NAME = 'Store File Naming';

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description:
			'Store files must use the .svelte.ts extension. This is required for Svelte 5 runes to work correctly.',
		category: 'naming',
		severity: 'error',
		businessRule:
			'Svelte 5 runes require .svelte.ts extension to enable reactive declarations ($state, $derived, $effect).',
		enabledByDefault: true,
		include: ['**/stores/**/*.ts'],
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Find all nodes in the stores layer or stores directory
		const storeNodes = engine.getNodes((n) => {
			// Check if it's in stores/ directory
			const isInStoresDir = n.filePath?.includes('/stores/') ?? false;

			// Must be a TypeScript file
			const isTypeScriptFile = n.filePath?.endsWith('.ts') || n.filePath?.endsWith('.svelte.ts');

			return isInStoresDir && isTypeScriptFile === true;
		});

		for (const node of storeNodes) {
			if (!node.filePath) continue;

			// Skip index files (barrel exports)
			if (node.name === 'index') continue;

			// Skip test files
			if (node.filePath.includes('.test.') || node.filePath.includes('__tests__')) {
				continue;
			}

			// Check if file uses .svelte.ts extension
			const hasSvelteExtension = node.filePath.endsWith('.svelte.ts');

			if (!hasSvelteExtension) {
				const violation = createViolation(
					INVARIANT_ID,
					INVARIANT_NAME,
					`Store file '${node.name}' should use .svelte.ts extension for Svelte 5 runes support.`,
					node.id,
					'error',
				);

				// Add evidence
				violation.evidence = [
					{
						filePath: node.filePath,
						line: 1,
					},
				];

				violation.businessRule =
					'Svelte 5 runes ($state, $derived, $effect) require .svelte.ts file extension.';
				violation.suggestion = `Rename ${node.filePath.split('/').pop()} to ${node.name}.svelte.ts`;

				violations.push(violation);
			}
		}

		return violations;
	},
);
