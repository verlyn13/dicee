/**
 * Config Schema Tests
 *
 * Unit tests for AKG configuration schemas using Zod 4.
 */

import { describe, expect, it } from 'vitest';
import {
	AKGConfig,
	CIConfig,
	type DeepPartial,
	DiscoveryConfig,
	defaultConfig,
	InvariantOverride,
	InvariantsConfig,
	LayerDefinition,
	mergeWithDefaults,
	OutputConfig,
	safeValidateConfig,
	validateConfig,
} from '../../schema/config.schema.js';

// =============================================================================
// LayerDefinition Tests
// =============================================================================

describe('LayerDefinition schema', () => {
	it('should accept valid layer definition', () => {
		const layer = {
			name: 'components',
			paths: ['packages/web/src/lib/components/**'],
			description: 'UI components',
			mayImport: ['types', 'utils'],
			mayNotImport: ['stores', 'services'],
		};

		expect(() => LayerDefinition.parse(layer)).not.toThrow();
	});

	it('should accept minimal layer definition', () => {
		const layer = {
			name: 'types',
			paths: ['packages/web/src/lib/types/**'],
		};

		const result = LayerDefinition.parse(layer);
		expect(result.name).toBe('types');
		expect(result.mayImport).toBeUndefined();
	});

	it('should reject empty name', () => {
		const layer = {
			name: '',
			paths: ['**/*.ts'],
		};

		expect(() => LayerDefinition.parse(layer)).toThrow();
	});

	it('should reject empty paths array', () => {
		const layer = {
			name: 'components',
			paths: [],
		};

		expect(() => LayerDefinition.parse(layer)).toThrow();
	});

	it('should accept layer with notes', () => {
		const layer = {
			name: 'components',
			paths: ['**/*.svelte'],
			notes: 'Smart containers may import stores (exception)',
		};

		const result = LayerDefinition.parse(layer);
		expect(result.notes).toBe('Smart containers may import stores (exception)');
	});
});

// =============================================================================
// InvariantOverride Tests
// =============================================================================

describe('InvariantOverride schema', () => {
	it('should accept severity override', () => {
		const override = {
			id: 'layer_component_isolation',
			severity: 'warning',
		};

		const result = InvariantOverride.parse(override);
		expect(result.severity).toBe('warning');
	});

	it('should accept enabled toggle', () => {
		const override = {
			id: 'no_direct_wasm',
			enabled: false,
		};

		const result = InvariantOverride.parse(override);
		expect(result.enabled).toBe(false);
	});

	it('should accept exclude patterns', () => {
		const override = {
			id: 'no_console',
			exclude: ['**/debug/**', '**/test/**'],
		};

		const result = InvariantOverride.parse(override);
		expect(result.exclude).toHaveLength(2);
	});

	it('should reject empty id', () => {
		const override = {
			id: '',
			severity: 'warning',
		};

		expect(() => InvariantOverride.parse(override)).toThrow();
	});
});

// =============================================================================
// InvariantsConfig Tests
// =============================================================================

describe('InvariantsConfig schema', () => {
	it('should accept enable list', () => {
		const config = {
			enable: ['strict_imports', 'no_cycles'],
		};

		const result = InvariantsConfig.parse(config);
		expect(result.enable).toHaveLength(2);
	});

	it('should accept disable list', () => {
		const config = {
			disable: ['no_console', 'strict_types'],
		};

		const result = InvariantsConfig.parse(config);
		expect(result.disable).toHaveLength(2);
	});

	it('should accept overrides array', () => {
		const config = {
			overrides: [
				{ id: 'layer_violation', severity: 'warning' },
				{ id: 'no_cycles', enabled: false },
			],
		};

		const result = InvariantsConfig.parse(config);
		expect(result.overrides).toHaveLength(2);
	});

	it('should accept empty config', () => {
		expect(() => InvariantsConfig.parse({})).not.toThrow();
	});
});

// =============================================================================
// DiscoveryConfig Tests
// =============================================================================

describe('DiscoveryConfig schema', () => {
	it('should provide defaults', () => {
		const config = {};

		const result = DiscoveryConfig.parse(config);
		expect(result.include).toBeDefined();
		expect(result.exclude).toBeDefined();
		expect(result.tsconfig).toBe('packages/web/tsconfig.json');
	});

	it('should accept custom patterns', () => {
		const config = {
			include: ['src/**/*.ts'],
			exclude: ['**/*.test.ts'],
			tsconfig: 'tsconfig.json',
		};

		const result = DiscoveryConfig.parse(config);
		expect(result.include).toEqual(['src/**/*.ts']);
		expect(result.tsconfig).toBe('tsconfig.json');
	});

	it('should allow partial override', () => {
		const config = {
			tsconfig: 'custom/tsconfig.json',
		};

		const result = DiscoveryConfig.parse(config);
		expect(result.tsconfig).toBe('custom/tsconfig.json');
		// Defaults should still be present
		expect(result.include.length).toBeGreaterThan(0);
	});
});

// =============================================================================
// OutputConfig Tests
// =============================================================================

describe('OutputConfig schema', () => {
	it('should provide defaults', () => {
		const config = {};

		const result = OutputConfig.parse(config);
		expect(result.graphPath).toBe('docs/architecture/akg/graph/current.json');
		expect(result.history).toBe(true);
		expect(result.historyPath).toBe('docs/architecture/akg/graph/history');
	});

	it('should accept custom paths', () => {
		const config = {
			graphPath: 'custom/graph.json',
			history: false,
			historyPath: 'custom/history',
		};

		const result = OutputConfig.parse(config);
		expect(result.graphPath).toBe('custom/graph.json');
		expect(result.history).toBe(false);
	});
});

// =============================================================================
// CIConfig Tests
// =============================================================================

describe('CIConfig schema', () => {
	it('should provide defaults', () => {
		const config = {};

		const result = CIConfig.parse(config);
		expect(result.failOnError).toBe(true);
		expect(result.failOnWarning).toBe(false);
		expect(result.sarif).toBe(false);
	});

	it('should accept strict CI settings', () => {
		const config = {
			failOnError: true,
			failOnWarning: true,
			sarif: true,
		};

		const result = CIConfig.parse(config);
		expect(result.failOnWarning).toBe(true);
		expect(result.sarif).toBe(true);
	});
});

// =============================================================================
// AKGConfig Tests
// =============================================================================

describe('AKGConfig schema', () => {
	it('should accept minimal config', () => {
		const config = {
			project: 'test-project',
		};

		const result = AKGConfig.parse(config);
		expect(result.project).toBe('test-project');
		expect(result.version).toBe('1.0.0');
	});

	it('should accept full config', () => {
		const config = {
			version: '2.0.0',
			project: 'dicee',
			discovery: {
				include: ['src/**/*.ts'],
				exclude: ['**/*.test.ts'],
				tsconfig: 'tsconfig.json',
			},
			layers: [
				{
					name: 'components',
					paths: ['src/components/**'],
					mayImport: ['types'],
				},
			],
			invariants: {
				disable: ['no_console'],
			},
			output: {
				graphPath: 'graph.json',
				history: true,
				historyPath: 'history',
			},
			ci: {
				failOnError: true,
				failOnWarning: false,
				sarif: false,
			},
		};

		const result = AKGConfig.parse(config);
		expect(result.layers).toHaveLength(1);
		expect(result.invariants?.disable).toContain('no_console');
	});

	it('should reject empty project name', () => {
		const config = {
			project: '',
		};

		expect(() => AKGConfig.parse(config)).toThrow();
	});
});

// =============================================================================
// defaultConfig Tests
// =============================================================================

describe('defaultConfig', () => {
	it('should be valid against schema', () => {
		expect(() => AKGConfig.parse(defaultConfig)).not.toThrow();
	});

	it('should have dicee as project name', () => {
		expect(defaultConfig.project).toBe('dicee');
	});

	it('should have all 7 layers defined', () => {
		expect(defaultConfig.layers).toHaveLength(7);
	});

	it('should have correct layer names', () => {
		const layerNames = defaultConfig.layers?.map((l) => l.name) ?? [];
		expect(layerNames).toContain('routes');
		expect(layerNames).toContain('components');
		expect(layerNames).toContain('stores');
		expect(layerNames).toContain('services');
		expect(layerNames).toContain('types');
		expect(layerNames).toContain('supabase');
		expect(layerNames).toContain('wasm');
	});

	it('should enforce layer dependency rules', () => {
		const componentsLayer = defaultConfig.layers?.find((l) => l.name === 'components');
		expect(componentsLayer?.mayNotImport).toContain('stores');
		expect(componentsLayer?.mayNotImport).toContain('services');
	});
});

// =============================================================================
// mergeWithDefaults Tests
// =============================================================================

describe('mergeWithDefaults', () => {
	it('should return defaults for empty config', () => {
		const result = mergeWithDefaults({});

		expect(result.project).toBe('dicee');
		expect(result.version).toBe('1.0.0');
		expect(result.discovery?.include?.length).toBeGreaterThan(0);
	});

	it('should preserve user project name', () => {
		const result = mergeWithDefaults({ project: 'my-project' });

		expect(result.project).toBe('my-project');
	});

	it('should merge discovery config', () => {
		const input: DeepPartial<AKGConfig> = {
			discovery: {
				tsconfig: 'custom/tsconfig.json',
			},
		};
		const result = mergeWithDefaults(input);

		expect(result.discovery?.tsconfig).toBe('custom/tsconfig.json');
		// Should still have default include/exclude
		expect(result.discovery?.include?.length).toBeGreaterThan(0);
	});

	it('should preserve user layers', () => {
		const customLayers = [{ name: 'custom', paths: ['src/**'] }];
		const result = mergeWithDefaults({ layers: customLayers });

		expect(result.layers).toHaveLength(1);
		expect(result.layers?.[0].name).toBe('custom');
	});

	it('should merge output config', () => {
		const input: DeepPartial<AKGConfig> = {
			output: {
				graphPath: 'custom/graph.json',
			},
		};
		const result = mergeWithDefaults(input);

		expect(result.output?.graphPath).toBe('custom/graph.json');
		expect(result.output?.history).toBe(true); // default preserved
	});

	it('should merge CI config', () => {
		const input: DeepPartial<AKGConfig> = {
			ci: {
				failOnWarning: true,
			},
		};
		const result = mergeWithDefaults(input);

		expect(result.ci?.failOnWarning).toBe(true);
		expect(result.ci?.failOnError).toBe(true); // default preserved
	});

	it('should produce valid config', () => {
		const input: DeepPartial<AKGConfig> = {
			project: 'test',
			discovery: { tsconfig: 'custom.json' },
		};
		const result = mergeWithDefaults(input);

		expect(() => AKGConfig.parse(result)).not.toThrow();
	});
});

// =============================================================================
// Validation Utility Tests
// =============================================================================

describe('validateConfig', () => {
	it('should return parsed config for valid input', () => {
		const config = { project: 'test' };
		const result = validateConfig(config);

		expect(result.project).toBe('test');
	});

	it('should throw for invalid config', () => {
		const config = { project: '' };

		expect(() => validateConfig(config)).toThrow();
	});
});

describe('safeValidateConfig', () => {
	it('should return success result for valid config', () => {
		const config = { project: 'test' };
		const result = safeValidateConfig(config);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.project).toBe('test');
		}
	});

	it('should return error result for invalid config', () => {
		const config = { project: '' };
		const result = safeValidateConfig(config);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeDefined();
		}
	});

	it('should provide ZodError for debugging', () => {
		const config = { project: 123 }; // wrong type
		const result = safeValidateConfig(config);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});
});
