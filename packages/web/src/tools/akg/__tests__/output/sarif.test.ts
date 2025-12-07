/**
 * SARIF Output Tests
 *
 * Tests for the SARIF output format conversion.
 */

import { describe, expect, it } from 'vitest';
// Import invariants module to ensure they're registered before tests
import '../../invariants/definitions/index.js';
import { toSarif, toSarifString, validateSarif } from '../../output/sarif.js';
import type { CheckSummary } from '../../schema/invariant.schema.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createPassingSummary(): CheckSummary {
	return {
		timestamp: '2025-12-07T00:00:00.000Z',
		totalDurationMs: 1.5,
		graphVersion: '1.0.0',
		results: [
			{
				invariantId: 'wasm_single_entry',
				passed: true,
				violations: [],
				durationMs: 0.5,
				nodesChecked: 100,
				edgesChecked: 200,
			},
			{
				invariantId: 'store_no_circular_deps',
				passed: true,
				violations: [],
				durationMs: 0.3,
				nodesChecked: 100,
				edgesChecked: 200,
			},
		],
		summary: {
			totalInvariants: 2,
			passed: 2,
			failed: 0,
			errors: 0,
			warnings: 0,
			infos: 0,
		},
		exitCode: 'success',
	};
}

function createFailingSummary(): CheckSummary {
	return {
		timestamp: '2025-12-07T00:00:00.000Z',
		totalDurationMs: 2.0,
		graphVersion: '1.0.0',
		results: [
			{
				invariantId: 'wasm_single_entry',
				passed: false,
				violations: [
					{
						invariantId: 'wasm_single_entry',
						invariantName: 'WASM Single Entry Point',
						severity: 'error',
						message: 'Direct WASM import not allowed. Use engine.ts bridge.',
						sourceNode: 'component::ScorePreview',
						targetNode: 'wasm::dicee_engine',
						evidence: [
							{
								filePath: 'packages/web/src/lib/components/ScorePreview.svelte',
								line: 5,
								column: 1,
								snippet: "import { analyze_turn } from '$lib/wasm/dicee_engine';",
							},
						],
						suggestion: "Import from '$lib/engine' instead of '$lib/wasm/'",
						businessRule: 'WASM bindings are internal implementation details',
					},
				],
				durationMs: 0.5,
				nodesChecked: 100,
				edgesChecked: 200,
			},
			{
				invariantId: 'layer_component_isolation',
				passed: false,
				violations: [
					{
						invariantId: 'layer_component_isolation',
						invariantName: 'Component Layer Isolation',
						severity: 'warning',
						message: 'Component imports store directly',
						sourceNode: 'component::PlayerScore',
						evidence: [
							{
								filePath: 'packages/web/src/lib/components/PlayerScore.svelte',
								line: 3,
							},
						],
					},
				],
				durationMs: 0.3,
				nodesChecked: 100,
				edgesChecked: 200,
			},
		],
		summary: {
			totalInvariants: 2,
			passed: 0,
			failed: 2,
			errors: 1,
			warnings: 1,
			infos: 0,
		},
		exitCode: 'errors',
	};
}

// =============================================================================
// Tests
// =============================================================================

describe('SARIF Output', () => {
	describe('toSarif', () => {
		it('should produce valid SARIF 2.1.0 structure', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary);

			expect(sarif.version).toBe('2.1.0');
			expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
			expect(sarif.runs).toHaveLength(1);
		});

		it('should include tool information', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary, { toolVersion: '2.0.0' });

			expect(sarif.runs[0].tool.driver.name).toBe('AKG');
			expect(sarif.runs[0].tool.driver.version).toBe('2.0.0');
			expect(sarif.runs[0].tool.driver.rules).toBeInstanceOf(Array);
		});

		it('should include custom informationUri', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary, {
				informationUri: 'https://example.com/docs',
			});

			expect(sarif.runs[0].tool.driver.informationUri).toBe('https://example.com/docs');
		});

		it('should have empty results for passing checks', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary);

			expect(sarif.runs[0].results).toHaveLength(0);
		});

		it('should include violations as results', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary);

			// Should have 2 violations (1 error + 1 warning)
			expect(sarif.runs[0].results).toHaveLength(2);
		});

		it('should map severity to SARIF level correctly', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary);

			const errorResult = sarif.runs[0].results.find((r) => r.ruleId === 'wasm_single_entry');
			const warningResult = sarif.runs[0].results.find(
				(r) => r.ruleId === 'layer_component_isolation',
			);

			expect(errorResult?.level).toBe('error');
			expect(warningResult?.level).toBe('warning');
		});

		it('should include location information from evidence', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary);

			const result = sarif.runs[0].results[0];
			expect(result.locations).toHaveLength(1);

			const location = result.locations![0];
			expect(location.physicalLocation?.artifactLocation.uri).toBe(
				'packages/web/src/lib/components/ScorePreview.svelte',
			);
			expect(location.physicalLocation?.region?.startLine).toBe(5);
			expect(location.physicalLocation?.region?.startColumn).toBe(1);
		});

		it('should include snippet when available', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary);

			const result = sarif.runs[0].results[0];
			expect(result.locations![0].physicalLocation?.region?.snippet?.text).toContain(
				'analyze_turn',
			);
		});

		it('should include message with suggestion in markdown', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary);

			const result = sarif.runs[0].results[0];
			expect(result.message.text).toBe('Direct WASM import not allowed. Use engine.ts bridge.');
			expect(result.message.markdown).toContain('**Suggestion:**');
		});

		it('should include invocation details when requested', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary, {
				includeInvocation: true,
				startTime: '2025-12-07T00:00:00.000Z',
			});

			expect(sarif.runs[0].invocations).toHaveLength(1);
			expect(sarif.runs[0].invocations![0].executionSuccessful).toBe(true);
			expect(sarif.runs[0].invocations![0].endTimeUtc).toBe('2025-12-07T00:00:00.000Z');
		});

		it('should set executionSuccessful to false for errors', () => {
			const summary = createFailingSummary();
			const sarif = toSarif(summary, { includeInvocation: true });

			expect(sarif.runs[0].invocations![0].executionSuccessful).toBe(false);
			expect(sarif.runs[0].invocations![0].exitCode).toBe(1);
		});
	});

	describe('toSarifString', () => {
		it('should produce valid JSON string', () => {
			const summary = createPassingSummary();
			const json = toSarifString(summary);

			expect(() => JSON.parse(json)).not.toThrow();
		});

		it('should be parseable back to SARIF structure', () => {
			const summary = createFailingSummary();
			const json = toSarifString(summary);
			const parsed = JSON.parse(json);

			expect(parsed.version).toBe('2.1.0');
			expect(parsed.runs).toHaveLength(1);
		});
	});

	describe('validateSarif', () => {
		it('should return true for valid SARIF', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary);

			expect(validateSarif(sarif)).toBe(true);
		});

		it('should return false for invalid version', () => {
			const invalidSarif = {
				version: '1.0.0',
				runs: [{ tool: {}, results: [] }],
			};

			expect(validateSarif(invalidSarif)).toBe(false);
		});

		it('should return false for missing runs', () => {
			const invalidSarif = {
				version: '2.1.0',
			};

			expect(validateSarif(invalidSarif)).toBe(false);
		});

		it('should return false for empty runs array', () => {
			const invalidSarif = {
				version: '2.1.0',
				runs: [],
			};

			expect(validateSarif(invalidSarif)).toBe(false);
		});

		it('should return false for null input', () => {
			expect(validateSarif(null)).toBe(false);
		});

		it('should return false for non-object input', () => {
			expect(validateSarif('not an object')).toBe(false);
		});
	});

	describe('Rule Registration', () => {
		it('should include all registered invariants as rules', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary);

			// Should have at least the 4 built-in invariants
			expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThanOrEqual(4);
		});

		it('should include rule metadata', () => {
			const summary = createPassingSummary();
			const sarif = toSarif(summary);

			const wasmRule = sarif.runs[0].tool.driver.rules.find((r) => r.id === 'wasm_single_entry');

			expect(wasmRule).toBeDefined();
			expect(wasmRule?.name).toBe('WASM Single Entry Point');
			expect(wasmRule?.defaultConfiguration?.level).toBe('error');
			expect(wasmRule?.properties?.category).toBe('structural');
		});
	});
});
