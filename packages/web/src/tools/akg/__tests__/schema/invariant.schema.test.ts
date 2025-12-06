/**
 * Invariant Schema Tests
 *
 * Unit tests for AKG invariant schemas using Zod 4.
 */

import { describe, expect, it } from 'vitest';
import {
	aggregateCounts,
	CheckSummary,
	CheckSummaryCounts,
	calculateExitCode,
	createCheckSummary,
	createViolation,
	ExitCode,
	InvariantCategory,
	InvariantCheckResult,
	InvariantDefinition,
	InvariantMeta,
	InvariantViolation,
	ViolationEvidence,
} from '../../schema/invariant.schema.js';

// =============================================================================
// InvariantCategory Tests
// =============================================================================

describe('InvariantCategory enum', () => {
	it('should accept valid categories', () => {
		expect(InvariantCategory.parse('structural')).toBe('structural');
		expect(InvariantCategory.parse('naming')).toBe('naming');
		expect(InvariantCategory.parse('domain')).toBe('domain');
		expect(InvariantCategory.parse('security')).toBe('security');
		expect(InvariantCategory.parse('performance')).toBe('performance');
	});

	it('should reject invalid category', () => {
		expect(() => InvariantCategory.parse('unknown')).toThrow();
	});
});

// =============================================================================
// InvariantMeta Tests
// =============================================================================

describe('InvariantMeta schema', () => {
	it('should accept minimal meta', () => {
		const meta = {
			added: '1.0.0',
		};

		expect(() => InvariantMeta.parse(meta)).not.toThrow();
	});

	it('should accept deprecated meta', () => {
		const meta = {
			added: '1.0.0',
			deprecated: '2.0.0',
			replacedBy: 'new_invariant_id',
		};

		const result = InvariantMeta.parse(meta);
		expect(result.deprecated).toBe('2.0.0');
		expect(result.replacedBy).toBe('new_invariant_id');
	});
});

// =============================================================================
// InvariantDefinition Tests
// =============================================================================

describe('InvariantDefinition schema', () => {
	const validDefinition = {
		id: 'no_direct_wasm_import',
		name: 'No Direct WASM Import',
		description: 'Components should not import WASM modules directly',
		category: 'structural',
		severity: 'error',
		businessRule: 'WASM must be accessed through engine.ts bridge',
		enabledByDefault: true,
	};

	it('should accept valid definition', () => {
		expect(() => InvariantDefinition.parse(validDefinition)).not.toThrow();
	});

	it('should accept definition with all optional fields', () => {
		const fullDefinition = {
			...validDefinition,
			docsUrl: 'https://docs.example.com/rules/no-direct-wasm',
			include: ['packages/web/src/**'],
			exclude: ['**/engine.ts'],
			fixable: false,
			meta: {
				added: '1.0.0',
			},
		};

		const result = InvariantDefinition.parse(fullDefinition);
		expect(result.docsUrl).toBe('https://docs.example.com/rules/no-direct-wasm');
		expect(result.include).toHaveLength(1);
	});

	it('should reject non-snake_case id', () => {
		const invalid = {
			...validDefinition,
			id: 'noDirectWasm', // camelCase not allowed
		};

		expect(() => InvariantDefinition.parse(invalid)).toThrow();
	});

	it('should reject id starting with number', () => {
		const invalid = {
			...validDefinition,
			id: '1_invalid_id',
		};

		expect(() => InvariantDefinition.parse(invalid)).toThrow();
	});

	it('should accept various valid snake_case ids', () => {
		const ids = ['layer_violation', 'no_cycles', 'a', 'test123', 'foo_bar_baz'];

		for (const id of ids) {
			const def = { ...validDefinition, id };
			expect(() => InvariantDefinition.parse(def)).not.toThrow();
		}
	});

	it('should default enabledByDefault to true', () => {
		const withoutDefault = {
			id: 'test_invariant',
			name: 'Test',
			description: 'Test invariant',
			category: 'structural',
			severity: 'warning',
			businessRule: 'Test rule',
		};

		const result = InvariantDefinition.parse(withoutDefault);
		expect(result.enabledByDefault).toBe(true);
	});

	it('should default fixable to false', () => {
		const result = InvariantDefinition.parse(validDefinition);
		expect(result.fixable).toBe(false);
	});
});

// =============================================================================
// ViolationEvidence Tests
// =============================================================================

describe('ViolationEvidence schema', () => {
	it('should accept minimal evidence', () => {
		const evidence = {
			filePath: 'src/components/Die.svelte',
			line: 42,
		};

		expect(() => ViolationEvidence.parse(evidence)).not.toThrow();
	});

	it('should accept full evidence', () => {
		const evidence = {
			filePath: 'src/components/Die.svelte',
			line: 42,
			column: 10,
			endLine: 42,
			endColumn: 50,
			snippet: "import { rollDie } from '../wasm/dicee';",
		};

		const result = ViolationEvidence.parse(evidence);
		expect(result.snippet).toContain('import');
	});

	it('should reject negative line number', () => {
		const evidence = {
			filePath: 'test.ts',
			line: -1,
		};

		expect(() => ViolationEvidence.parse(evidence)).toThrow();
	});

	it('should reject zero line number', () => {
		const evidence = {
			filePath: 'test.ts',
			line: 0,
		};

		expect(() => ViolationEvidence.parse(evidence)).toThrow();
	});
});

// =============================================================================
// InvariantViolation Tests
// =============================================================================

describe('InvariantViolation schema', () => {
	const validViolation = {
		invariantId: 'no_direct_wasm',
		invariantName: 'No Direct WASM Import',
		severity: 'error',
		message: 'Direct WASM import detected in component',
		sourceNode: 'component::Die::abc123',
		evidence: [
			{
				filePath: 'src/components/Die.svelte',
				line: 5,
				snippet: "import { rollDie } from '../wasm';",
			},
		],
	};

	it('should accept valid violation', () => {
		expect(() => InvariantViolation.parse(validViolation)).not.toThrow();
	});

	it('should accept violation with all fields', () => {
		const fullViolation = {
			...validViolation,
			suggestion: "Import from '$lib/engine' instead",
			targetNode: 'wasm::dicee_bg::xyz789',
			businessRule: 'WASM access must go through engine bridge',
			context: {
				importedFunction: 'rollDie',
				layer: 'components',
			},
		};

		const result = InvariantViolation.parse(fullViolation);
		expect(result.suggestion).toContain('engine');
		expect(result.context?.importedFunction).toBe('rollDie');
	});

	it('should accept empty evidence array', () => {
		const violation = {
			...validViolation,
			evidence: [],
		};

		expect(() => InvariantViolation.parse(violation)).not.toThrow();
	});

	it('should reject empty invariantId', () => {
		const violation = {
			...validViolation,
			invariantId: '',
		};

		expect(() => InvariantViolation.parse(violation)).toThrow();
	});
});

// =============================================================================
// InvariantCheckResult Tests
// =============================================================================

describe('InvariantCheckResult schema', () => {
	it('should accept passing result', () => {
		const result = {
			invariantId: 'no_cycles',
			passed: true,
			violations: [],
			durationMs: 42,
			nodesChecked: 100,
			edgesChecked: 150,
		};

		expect(() => InvariantCheckResult.parse(result)).not.toThrow();
	});

	it('should accept failing result with violations', () => {
		const result = {
			invariantId: 'layer_violation',
			passed: false,
			violations: [
				{
					invariantId: 'layer_violation',
					invariantName: 'Layer Violation',
					severity: 'error',
					message: 'Component imports store directly',
					sourceNode: 'component::Die',
					evidence: [],
				},
			],
			durationMs: 100,
			nodesChecked: 50,
			edgesChecked: 75,
		};

		const parsed = InvariantCheckResult.parse(result);
		expect(parsed.passed).toBe(false);
		expect(parsed.violations).toHaveLength(1);
	});

	it('should reject negative duration', () => {
		const result = {
			invariantId: 'test',
			passed: true,
			violations: [],
			durationMs: -1,
			nodesChecked: 0,
			edgesChecked: 0,
		};

		expect(() => InvariantCheckResult.parse(result)).toThrow();
	});
});

// =============================================================================
// ExitCode Tests
// =============================================================================

describe('ExitCode enum', () => {
	it('should accept valid exit codes', () => {
		expect(ExitCode.parse('success')).toBe('success');
		expect(ExitCode.parse('warnings')).toBe('warnings');
		expect(ExitCode.parse('errors')).toBe('errors');
	});

	it('should reject invalid exit code', () => {
		expect(() => ExitCode.parse('failure')).toThrow();
	});
});

// =============================================================================
// CheckSummaryCounts Tests
// =============================================================================

describe('CheckSummaryCounts schema', () => {
	it('should accept valid counts', () => {
		const counts = {
			totalInvariants: 10,
			passed: 8,
			failed: 2,
			errors: 1,
			warnings: 1,
			infos: 0,
		};

		expect(() => CheckSummaryCounts.parse(counts)).not.toThrow();
	});

	it('should reject negative counts', () => {
		const counts = {
			totalInvariants: 10,
			passed: -1,
			failed: 2,
			errors: 1,
			warnings: 1,
			infos: 0,
		};

		expect(() => CheckSummaryCounts.parse(counts)).toThrow();
	});
});

// =============================================================================
// CheckSummary Tests
// =============================================================================

describe('CheckSummary schema', () => {
	const validSummary = {
		timestamp: new Date().toISOString(),
		totalDurationMs: 1500,
		graphVersion: '1.0.0',
		results: [],
		summary: {
			totalInvariants: 0,
			passed: 0,
			failed: 0,
			errors: 0,
			warnings: 0,
			infos: 0,
		},
		exitCode: 'success',
	};

	it('should accept valid summary', () => {
		expect(() => CheckSummary.parse(validSummary)).not.toThrow();
	});

	it('should accept summary with results', () => {
		const summary = {
			...validSummary,
			results: [
				{
					invariantId: 'test',
					passed: true,
					violations: [],
					durationMs: 50,
					nodesChecked: 10,
					edgesChecked: 15,
				},
			],
			summary: {
				totalInvariants: 1,
				passed: 1,
				failed: 0,
				errors: 0,
				warnings: 0,
				infos: 0,
			},
		};

		const result = CheckSummary.parse(summary);
		expect(result.results).toHaveLength(1);
	});

	it('should reject invalid timestamp', () => {
		const summary = {
			...validSummary,
			timestamp: 'not-a-date',
		};

		expect(() => CheckSummary.parse(summary)).toThrow();
	});
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createCheckSummary', () => {
	it('should create valid empty summary', () => {
		const summary = createCheckSummary('1.0.0');

		expect(summary.graphVersion).toBe('1.0.0');
		expect(summary.results).toHaveLength(0);
		expect(summary.exitCode).toBe('success');
		expect(() => CheckSummary.parse(summary)).not.toThrow();
	});

	it('should have current timestamp', () => {
		const before = Date.now();
		const summary = createCheckSummary('1.0.0');
		const after = Date.now();

		const timestamp = new Date(summary.timestamp).getTime();
		expect(timestamp).toBeGreaterThanOrEqual(before);
		expect(timestamp).toBeLessThanOrEqual(after);
	});
});

describe('calculateExitCode', () => {
	it('should return success for empty results', () => {
		expect(calculateExitCode([])).toBe('success');
	});

	it('should return success for all passing results', () => {
		const results = [
			{
				invariantId: 'a',
				passed: true,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'b',
				passed: true,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		expect(calculateExitCode(results)).toBe('success');
	});

	it('should return warnings for warning violations', () => {
		const results = [
			{
				invariantId: 'a',
				passed: false,
				violations: [
					{
						invariantId: 'a',
						invariantName: 'A',
						severity: 'warning' as const,
						message: 'warning',
						sourceNode: 'x',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		expect(calculateExitCode(results)).toBe('warnings');
	});

	it('should return errors for error violations', () => {
		const results = [
			{
				invariantId: 'a',
				passed: false,
				violations: [
					{
						invariantId: 'a',
						invariantName: 'A',
						severity: 'error' as const,
						message: 'error',
						sourceNode: 'x',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		expect(calculateExitCode(results)).toBe('errors');
	});

	it('should prioritize errors over warnings', () => {
		const results = [
			{
				invariantId: 'a',
				passed: false,
				violations: [
					{
						invariantId: 'a',
						invariantName: 'A',
						severity: 'warning' as const,
						message: 'warning',
						sourceNode: 'x',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'b',
				passed: false,
				violations: [
					{
						invariantId: 'b',
						invariantName: 'B',
						severity: 'error' as const,
						message: 'error',
						sourceNode: 'y',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		expect(calculateExitCode(results)).toBe('errors');
	});
});

describe('aggregateCounts', () => {
	it('should count empty results', () => {
		const counts = aggregateCounts([]);

		expect(counts.totalInvariants).toBe(0);
		expect(counts.passed).toBe(0);
		expect(counts.failed).toBe(0);
	});

	it('should count passed and failed', () => {
		const results = [
			{
				invariantId: 'a',
				passed: true,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'b',
				passed: false,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'c',
				passed: true,
				violations: [],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		const counts = aggregateCounts(results);
		expect(counts.totalInvariants).toBe(3);
		expect(counts.passed).toBe(2);
		expect(counts.failed).toBe(1);
	});

	it('should count violations by severity', () => {
		const results = [
			{
				invariantId: 'a',
				passed: false,
				violations: [
					{
						invariantId: 'a',
						invariantName: 'A',
						severity: 'error' as const,
						message: 'e',
						sourceNode: 'x',
						evidence: [],
					},
					{
						invariantId: 'a',
						invariantName: 'A',
						severity: 'error' as const,
						message: 'e',
						sourceNode: 'y',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'b',
				passed: false,
				violations: [
					{
						invariantId: 'b',
						invariantName: 'B',
						severity: 'warning' as const,
						message: 'w',
						sourceNode: 'z',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
			{
				invariantId: 'c',
				passed: false,
				violations: [
					{
						invariantId: 'c',
						invariantName: 'C',
						severity: 'info' as const,
						message: 'i',
						sourceNode: 'a',
						evidence: [],
					},
				],
				durationMs: 10,
				nodesChecked: 5,
				edgesChecked: 5,
			},
		];

		const counts = aggregateCounts(results);
		expect(counts.errors).toBe(2);
		expect(counts.warnings).toBe(1);
		expect(counts.infos).toBe(1);
	});
});

describe('createViolation', () => {
	it('should create violation with defaults', () => {
		const violation = createViolation(
			'test_invariant',
			'Test Invariant',
			'Test message',
			'node::test',
		);

		expect(violation.invariantId).toBe('test_invariant');
		expect(violation.invariantName).toBe('Test Invariant');
		expect(violation.message).toBe('Test message');
		expect(violation.sourceNode).toBe('node::test');
		expect(violation.severity).toBe('warning'); // default
		expect(violation.evidence).toEqual([]);
	});

	it('should accept custom severity', () => {
		const violation = createViolation('test', 'Test', 'msg', 'node', 'error');

		expect(violation.severity).toBe('error');
	});

	it('should produce valid violation', () => {
		const violation = createViolation('test', 'Test', 'msg', 'node', 'info');

		expect(() => InvariantViolation.parse(violation)).not.toThrow();
	});
});
