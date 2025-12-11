/**
 * Type Schema Consistency Invariant
 *
 * Enforces that public type files have corresponding .schema.ts files
 * with Zod schemas for runtime validation.
 */

import type { AKGGraph } from '../../schema/graph.schema.js';
import type { AKGQueryEngine, InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';
import { defineInvariant } from '../registry.js';

const INVARIANT_ID = 'type_schema_consistency';
const INVARIANT_NAME = 'Type Schema Consistency';

// Files to exclude from schema requirement check
const EXCLUDED_FILES = new Set([
	'database.ts', // Supabase auto-generated
	'category-convert.ts', // Utility functions, not type definitions
]);

defineInvariant(
	{
		id: INVARIANT_ID,
		name: INVARIANT_NAME,
		description: 'Public type files must have corresponding .schema.ts with z.infer exports',
		category: 'structural',
		severity: 'error',
		businessRule: 'Runtime validation requires all external types to have Zod schemas',
		enabledByDefault: true,
		include: ['**/types/**/*.ts'],
		exclude: [
			'**/*.schema.ts', // Schema files themselves
			'**/*.d.ts', // TypeScript declaration files
			'**/index.ts', // Barrel exports
			'**/database.ts', // Supabase auto-generated
			'**/category-convert.ts', // Utility functions
			'**/*.test.ts', // Test files
		],
	},
	(_graph: AKGGraph, engine: AKGQueryEngine): InvariantViolation[] => {
		const violations: InvariantViolation[] = [];

		// Get all type files in packages/web/src/lib/types/ directory only
		// Excludes shared package (which has schemas in a separate schemas/ directory)
		const typeFiles = engine.getNodes((n) => {
			if (!n.filePath) return false;

			// Only check files in the web package's types directory
			const isInWebTypesDir = n.filePath.includes('packages/web/src/lib/types/');
			const isTypeScript = n.filePath.endsWith('.ts');
			const isSchema = n.filePath.endsWith('.schema.ts');
			const isDeclaration = n.filePath.endsWith('.d.ts');
			const isIndex = n.name === 'index';
			const isTest = n.filePath.includes('.test.');

			// Extract filename for specific exclusions
			const filename = n.filePath.split('/').pop() || '';
			const isExcluded = EXCLUDED_FILES.has(filename);

			return (
				isInWebTypesDir &&
				isTypeScript &&
				!isSchema &&
				!isDeclaration &&
				!isIndex &&
				!isTest &&
				!isExcluded
			);
		});

		// Check each type file has corresponding schema
		for (const typeFile of typeFiles) {
			if (!typeFile.filePath) continue;

			const expectedSchemaPath = typeFile.filePath.replace('.ts', '.schema.ts');

			// Check if schema file exists in the graph
			const schemaExists = engine.getNodes((n) => n.filePath === expectedSchemaPath).length > 0;

			if (!schemaExists) {
				const violation = createViolation(
					INVARIANT_ID,
					INVARIANT_NAME,
					`Type file '${typeFile.name}.ts' missing corresponding schema file`,
					typeFile.id,
					'error',
				);

				// Add evidence
				violation.evidence = [
					{
						filePath: typeFile.filePath,
						line: 1,
					},
				];

				violation.businessRule =
					'Runtime validation requires all external types to have Zod schemas.';
				violation.suggestion = `Create ${typeFile.name}.schema.ts with Zod schemas for runtime validation`;

				violations.push(violation);
			}
		}

		return violations;
	},
);
