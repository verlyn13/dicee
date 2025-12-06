/**
 * Config Loader Tests
 *
 * Unit tests for AKG config loading utilities.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	CONFIG_FILE_NAMES,
	findAndLoadConfig,
	generateDefaultConfig,
	getDiscoveryPatterns,
	getProjectName,
	loadConfig,
	loadConfigFromPath,
	SUPPORTED_EXTENSIONS,
} from '../../config/loader.js';
import { defaultConfig } from '../../schema/config.schema.js';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;

beforeEach(async () => {
	testDir = join(tmpdir(), `akg-test-${Date.now()}`);
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	try {
		await rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('CONFIG_FILE_NAMES', () => {
	it('should include expected file names', () => {
		expect(CONFIG_FILE_NAMES).toContain('akg.config.ts');
		expect(CONFIG_FILE_NAMES).toContain('akg.config.json');
		expect(CONFIG_FILE_NAMES).toContain('.akgrc.json');
	});

	it('should prioritize ts over json', () => {
		const tsIndex = CONFIG_FILE_NAMES.indexOf('akg.config.ts');
		const jsonIndex = CONFIG_FILE_NAMES.indexOf('akg.config.json');
		expect(tsIndex).toBeLessThan(jsonIndex);
	});
});

describe('SUPPORTED_EXTENSIONS', () => {
	it('should include standard extensions', () => {
		expect(SUPPORTED_EXTENSIONS).toContain('.ts');
		expect(SUPPORTED_EXTENSIONS).toContain('.js');
		expect(SUPPORTED_EXTENSIONS).toContain('.json');
		expect(SUPPORTED_EXTENSIONS).toContain('.mjs');
	});
});

// =============================================================================
// loadConfigFromPath Tests
// =============================================================================

describe('loadConfigFromPath', () => {
	it('should load valid JSON config', async () => {
		const configPath = join(testDir, 'akg.config.json');
		const config = { project: 'test-project' };
		await writeFile(configPath, JSON.stringify(config));

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config.project).toBe('test-project');
			expect(result.configPath).toBe(configPath);
		}
	});

	it('should merge with defaults', async () => {
		const configPath = join(testDir, 'akg.config.json');
		const config = { project: 'test-project' };
		await writeFile(configPath, JSON.stringify(config));

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(true);
		if (result.success) {
			// Should have defaults filled in
			expect(result.config.version).toBe('1.0.0');
			expect(result.config.discovery).toBeDefined();
			expect(result.config.ci).toBeDefined();
		}
	});

	it('should return error for non-existent file', async () => {
		const result = await loadConfigFromPath(join(testDir, 'nonexistent.json'));

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe('not_found');
		}
	});

	it('should return error for unsupported extension', async () => {
		const result = await loadConfigFromPath(join(testDir, 'config.yaml'));

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe('unsupported_format');
			expect(result.error.message).toContain('.yaml');
		}
	});

	it('should return error for invalid JSON', async () => {
		const configPath = join(testDir, 'invalid.json');
		await writeFile(configPath, '{ invalid json }');

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe('parse_error');
		}
	});

	it('should return error for invalid config schema', async () => {
		const configPath = join(testDir, 'akg.config.json');
		// Missing required 'project' field
		await writeFile(configPath, JSON.stringify({ version: '1.0.0' }));

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe('validation_error');
			expect(result.error.message).toContain('project');
		}
	});

	// Note: Dynamic imports from temp directories are problematic with Node's module resolution
	// These tests verify the loader handles JS files, but full JS loading is tested via actual project configs
	// biome-ignore lint/suspicious/noSkippedTests: Dynamic imports don't work from temp directories
	it.skip('should load JS config with default export (requires stable file path)', async () => {
		const configPath = join(testDir, 'akg.config.mjs');
		await writeFile(configPath, `export default { project: 'js-project' };`);

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config.project).toBe('js-project');
		}
	});

	// biome-ignore lint/suspicious/noSkippedTests: Dynamic imports don't work from temp directories
	it.skip('should load JS config with named export (requires stable file path)', async () => {
		const configPath = join(testDir, 'akg.config.mjs');
		await writeFile(configPath, `export const config = { project: 'named-project' };`);

		const result = await loadConfigFromPath(configPath);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config.project).toBe('named-project');
		}
	});
});

// =============================================================================
// findAndLoadConfig Tests
// =============================================================================

describe('findAndLoadConfig', () => {
	it('should find config in current directory', async () => {
		const configPath = join(testDir, 'akg.config.json');
		await writeFile(configPath, JSON.stringify({ project: 'found' }));

		const result = await findAndLoadConfig(testDir);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config.project).toBe('found');
		}
	});

	it('should find config in parent directory', async () => {
		const childDir = join(testDir, 'child');
		await mkdir(childDir);
		const configPath = join(testDir, 'akg.config.json');
		await writeFile(configPath, JSON.stringify({ project: 'parent' }));

		const result = await findAndLoadConfig(childDir);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config.project).toBe('parent');
		}
	});

	it('should return defaults if no config found', async () => {
		const emptyDir = join(testDir, 'empty');
		await mkdir(emptyDir);

		const result = await findAndLoadConfig(emptyDir);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.config).toEqual(defaultConfig);
			expect(result.configPath).toBeNull();
		}
	});

	// biome-ignore lint/suspicious/noSkippedTests: Dynamic imports don't work from temp directories
	it.skip('should prefer ts over json in same directory (requires stable file paths for dynamic imports)', async () => {
		// Create both files
		await writeFile(join(testDir, 'akg.config.json'), JSON.stringify({ project: 'json-project' }));
		await writeFile(join(testDir, 'akg.config.mjs'), `export default { project: 'ts-project' };`);

		const result = await findAndLoadConfig(testDir);

		expect(result.success).toBe(true);
		if (result.success) {
			// mjs should be loaded before json due to priority
			expect(result.config.project).toBe('ts-project');
		}
	});
});

// =============================================================================
// loadConfig Tests
// =============================================================================

describe('loadConfig', () => {
	it('should return defaults when no args provided', async () => {
		const config = await loadConfig();
		expect(config).toEqual(defaultConfig);
	});

	it('should load from specific path', async () => {
		const configPath = join(testDir, 'akg.config.json');
		await writeFile(configPath, JSON.stringify({ project: 'specific' }));

		const config = await loadConfig(configPath);

		expect(config.project).toBe('specific');
	});

	it('should search from project root', async () => {
		await writeFile(join(testDir, 'akg.config.json'), JSON.stringify({ project: 'root' }));

		const config = await loadConfig(undefined, testDir);

		expect(config.project).toBe('root');
	});

	it('should return defaults on error', async () => {
		const config = await loadConfig(join(testDir, 'nonexistent.json'));

		// Should return defaults, not throw
		expect(config).toEqual(defaultConfig);
	});
});

// =============================================================================
// generateDefaultConfig Tests
// =============================================================================

describe('generateDefaultConfig', () => {
	it('should generate valid JSON', () => {
		const content = generateDefaultConfig('json');
		const parsed = JSON.parse(content);

		expect(parsed.project).toBe('dicee');
		expect(parsed.version).toBe('1.0.0');
	});

	it('should generate TypeScript content', () => {
		const content = generateDefaultConfig('typescript');

		expect(content).toContain('const config: AKGConfig');
		expect(content).toContain('export default config');
		expect(content).toContain('dicee');
	});

	it('should default to TypeScript format', () => {
		const content = generateDefaultConfig();

		expect(content).toContain('export default');
	});
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('getProjectName', () => {
	it('should return project name from config', () => {
		const name = getProjectName(defaultConfig);
		expect(name).toBe('dicee');
	});

	it('should work with custom config', () => {
		const config = { ...defaultConfig, project: 'custom' };
		const name = getProjectName(config);
		expect(name).toBe('custom');
	});
});

describe('getDiscoveryPatterns', () => {
	it('should return discovery patterns from config', () => {
		const patterns = getDiscoveryPatterns(defaultConfig);

		expect(patterns.include.length).toBeGreaterThan(0);
		expect(patterns.exclude.length).toBeGreaterThan(0);
		expect(patterns.tsconfig).toBeDefined();
	});

	it('should return defaults for empty config', () => {
		const config = { project: 'test', version: '1.0.0' };
		const patterns = getDiscoveryPatterns(config);

		expect(patterns.include.length).toBeGreaterThan(0);
		expect(patterns.exclude).toContain('**/*.test.ts');
	});

	it('should respect custom patterns', () => {
		const config = {
			...defaultConfig,
			discovery: {
				include: ['custom/**/*.ts'],
				exclude: ['custom/**/*.test.ts'],
				tsconfig: 'custom/tsconfig.json',
			},
		};

		const patterns = getDiscoveryPatterns(config);

		expect(patterns.include).toEqual(['custom/**/*.ts']);
		expect(patterns.tsconfig).toBe('custom/tsconfig.json');
	});
});
