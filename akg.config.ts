/**
 * AKG Configuration
 *
 * Architectural Knowledge Graph configuration for Dicee project.
 *
 * @see docs/architecture/akg/WEEK_1_2_SCHEMA_INFRASTRUCTURE.md
 * @see docs/architecture/akg/PRE_AKG_PLANNING.md
 */

// Note: Schema types will be imported once implemented
// import type { AKGConfig } from './packages/web/src/tools/akg/schema/config.schema';

export default {
	version: '1.0.0',
	project: 'dicee',

	discovery: {
		include: [
			'packages/web/src/**/*.ts',
			'packages/web/src/**/*.svelte',
			'packages/partykit/src/**/*.ts',
		],
		exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/__mocks__/**', '**/node_modules/**'],
		tsconfig: 'packages/web/tsconfig.json',
	},

	layers: [
		{
			name: 'routes',
			paths: ['packages/web/src/routes/**'],
			mayImport: ['components', 'stores', 'services', 'types', 'lib'],
			description: 'SvelteKit page routes and layouts',
		},
		{
			name: 'components',
			paths: ['packages/web/src/lib/components/**'],
			mayImport: ['components', 'types', 'utils'],
			mayNotImport: ['stores', 'services'],
			notes: 'Smart containers may import stores (exception)',
		},
		{
			name: 'stores',
			paths: ['packages/web/src/lib/stores/**'],
			mayImport: ['services', 'types', 'supabase'],
			mayNotImport: ['components', 'routes'],
		},
		{
			name: 'services',
			paths: ['packages/web/src/lib/services/**'],
			mayImport: ['types', 'supabase', 'wasm'],
			mayNotImport: ['components', 'routes', 'stores'],
		},
		{
			name: 'types',
			paths: ['packages/web/src/lib/types/**', 'packages/web/src/lib/types.ts'],
			mayImport: ['types'],
		},
		{
			name: 'supabase',
			paths: ['packages/web/src/lib/supabase/**'],
			mayImport: ['types'],
			mayNotImport: ['components', 'routes', 'stores', 'services'],
		},
		{
			name: 'wasm',
			paths: ['packages/web/src/lib/wasm/**', 'packages/web/src/lib/engine.ts'],
			mayImport: ['types'],
			notes: 'Only engine.ts should be imported by other modules',
		},
	],

	invariants: {
		// Start with warnings for layer violations to avoid blocking
		overrides: [{ id: 'layer_component_isolation', severity: 'warning' as const }],
	},

	output: {
		graphPath: 'docs/architecture/akg/graph/current.json',
		history: true,
		historyPath: 'docs/architecture/akg/graph/history',
	},

	ci: {
		failOnError: true,
		failOnWarning: false,
		sarif: false,
	},
};
