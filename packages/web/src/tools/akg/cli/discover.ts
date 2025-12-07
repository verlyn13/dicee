#!/usr/bin/env bun

/**
 * AKG Discovery CLI
 *
 * Discovers the architectural knowledge graph from source code.
 * Outputs to docs/architecture/akg/graph/current.json
 *
 * Usage:
 *   bun run packages/web/src/tools/akg/cli/discover.ts [options]
 *
 * Options:
 *   --config <path>   Path to akg.config.ts (default: auto-detect)
 *   --output <path>   Output path (default: from config)
 *   --verbose         Enable verbose logging
 *   --dry-run         Analyze but don't write output
  --incremental, -i Only discover changed files (git diff)
  --base <branch>   Base branch for incremental (default: origin/main)
 *
 * @see docs/architecture/akg/WEEK_1_2_SCHEMA_INFRASTRUCTURE.md
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { SourceFile } from 'ts-morph';
import { type AKGConfig, loadConfig } from '../config/index.js';
import {
	analyzeImports,
	createAllEdgesForNode,
	createLayerMembershipEdges,
	createLayerNodes,
	createLayerRuleEdges,
	createNodeFromSvelte,
	createNodeFromTS,
	createPackageNodes,
	createProject,
	filterLocalImports,
	loadAndAnalyzeSvelteFile,
	type ProjectInitResult,
	type SvelteAnalysis,
} from '../discovery/index.js';
import {
	type AKGEdge,
	type AKGGraph,
	AKGGraph as AKGGraphSchema,
	type AKGNode,
	createEmptyGraph,
} from '../schema/graph.schema.js';

// =============================================================================
// Types
// =============================================================================

interface DiscoverOptions {
	configPath?: string;
	outputPath?: string;
	verbose?: boolean;
	dryRun?: boolean;
	/** Enable incremental discovery (only changed files) */
	incremental?: boolean;
	/** Base branch for incremental discovery */
	baseBranch?: string;
}

interface DiscoveryStats {
	tsFiles: number;
	svelteFiles: number;
	totalNodes: number;
	totalEdges: number;
	durationMs: number;
	packages: string[];
}

/** Simple logger for CLI output */
// biome-ignore lint/suspicious/noConsole: CLI tool requires console output
const log = (msg: string) => console.log(msg);
const logWarn = (msg: string) => console.warn(msg);
const logError = (msg: string) => console.error(msg);

// =============================================================================
// Discovery Pipeline Steps
// =============================================================================

/**
 * Analyze Svelte components from file paths
 */
async function analyzeSvelteComponents(
	svelteFiles: string[],
	projectRoot: string,
	verbose: boolean,
): Promise<SvelteAnalysis[]> {
	const analyses: SvelteAnalysis[] = [];
	for (const filePath of svelteFiles) {
		try {
			const analysis = await loadAndAnalyzeSvelteFile(filePath);
			analyses.push(analysis);
		} catch {
			if (verbose) logWarn(`  Warning: Failed to analyze ${relative(projectRoot, filePath)}`);
		}
	}
	return analyses;
}

/**
 * Create all graph nodes from source files
 */
function createGraphNodes(
	tsSourceFiles: SourceFile[],
	svelteAnalyses: SvelteAnalysis[],
	config: AKGConfig,
	projectRoot: string,
): AKGNode[] {
	const nodeOptions = { projectRoot, config };
	const nodes: AKGNode[] = [];

	// TypeScript nodes
	for (const sourceFile of tsSourceFiles) {
		nodes.push(createNodeFromTS(sourceFile, nodeOptions));
	}

	// Svelte nodes
	for (const analysis of svelteAnalyses) {
		nodes.push(createNodeFromSvelte(analysis, nodeOptions));
	}

	// Layer nodes (virtual)
	nodes.push(...createLayerNodes(config));

	// Package nodes
	const packageNames = [
		...new Set(nodes.map((n) => n.attributes.package).filter(Boolean)),
	] as string[];
	nodes.push(...createPackageNodes(packageNames));

	return nodes;
}

/**
 * Create all graph edges from relationships
 */
function createGraphEdges(
	nodes: AKGNode[],
	tsSourceFiles: SourceFile[],
	config: AKGConfig,
	projectRoot: string,
): AKGEdge[] {
	// Build node map for edge resolution
	const nodeMap = new Map<string, string>();
	for (const node of nodes) {
		if (node.filePath) {
			nodeMap.set(node.filePath, node.id);
		}
	}

	const edges: AKGEdge[] = [];
	const edgeOptions = { projectRoot, nodeMap };

	// Process TypeScript files for imports
	for (const sourceFile of tsSourceFiles) {
		const relativePath = relative(projectRoot, sourceFile.getFilePath());
		const nodeId = nodeMap.get(relativePath);
		if (!nodeId) continue;

		const node = nodes.find((n) => n.id === nodeId);
		if (!node) continue;

		const imports = analyzeImports(sourceFile, projectRoot);
		const localImports = filterLocalImports(imports);
		edges.push(...createAllEdgesForNode(node, localImports, edgeOptions));
	}

	// Layer membership edges
	edges.push(...createLayerMembershipEdges(nodes, config));

	// Layer rule edges
	edges.push(...createLayerRuleEdges(config));

	return edges;
}

/**
 * Write graph output to files
 */
async function writeGraphOutput(
	graph: AKGGraph,
	config: AKGConfig,
	projectRoot: string,
	outputPath: string | undefined,
	verbose: boolean,
): Promise<void> {
	const finalOutputPath =
		outputPath ?? config.output?.graphPath ?? 'docs/architecture/akg/graph/current.json';
	const absoluteOutputPath = resolve(projectRoot, finalOutputPath);

	// Ensure directory exists
	await mkdir(dirname(absoluteOutputPath), { recursive: true });

	// Write graph
	await writeFile(absoluteOutputPath, JSON.stringify(graph, null, '\t'));

	if (verbose) log(`Wrote graph to ${finalOutputPath}`);

	// Write history snapshot if enabled
	if (config.output?.history) {
		const historyPath = config.output?.historyPath ?? 'docs/architecture/akg/graph/history';
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const historyFile = resolve(projectRoot, historyPath, `graph-${timestamp}.json`);

		await mkdir(dirname(historyFile), { recursive: true });
		await writeFile(historyFile, JSON.stringify(graph, null, '\t'));

		if (verbose) log(`Wrote history snapshot to ${relative(projectRoot, historyFile)}`);
	}
}

// =============================================================================
// Main Discovery Function
// =============================================================================

/**
 * Run discovery and generate the AKG graph
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Discovery orchestration requires coordinated steps
export async function discover(options: DiscoverOptions = {}): Promise<{
	graph: AKGGraph;
	stats: DiscoveryStats;
}> {
	const startTime = performance.now();
	const verbose = options.verbose ?? false;
	const incremental = options.incremental ?? false;
	const baseBranch = options.baseBranch ?? 'origin/main';

	// Find project root
	const projectRoot = findProjectRoot();
	if (verbose) log(`Project root: ${projectRoot}`);

	// Load configuration
	const config = await loadConfig(options.configPath, projectRoot);
	if (verbose) log(`Loaded config for project: ${config.project}`);

	// Get changed files for incremental mode
	let changedFilesSet: Set<string> | null = null;
	if (incremental) {
		const changedFiles = getChangedFiles(baseBranch, projectRoot);
		if (changedFiles.length === 0) {
			if (verbose) log('No changed files detected, skipping discovery');
			// Return empty stats - no work needed
			const graph = createEmptyGraph(projectRoot);
			return {
				graph,
				stats: {
					tsFiles: 0,
					svelteFiles: 0,
					totalNodes: 0,
					totalEdges: 0,
					durationMs: Math.round(performance.now() - startTime),
					packages: [],
				},
			};
		}
		changedFilesSet = new Set(changedFiles);
		if (verbose) log(`Incremental mode: ${changedFiles.length} changed files`);
	}

	// Initialize empty graph
	const graph = createEmptyGraph(projectRoot);

	// Create ts-morph project
	if (verbose) log('Initializing ts-morph project...');
	const projectResult = await createProject(config, projectRoot);

	if (!projectResult.success) {
		logError(`Failed to create project: ${projectResult.error.message}`);
		process.exit(1);
	}

	let { sourceFiles: tsSourceFiles, stats: projectStats } = projectResult as ProjectInitResult;

	// Filter to changed files in incremental mode
	if (changedFilesSet) {
		tsSourceFiles = filterToChangedFiles(tsSourceFiles, changedFilesSet);
		if (verbose) log(`  Filtered to ${tsSourceFiles.length} changed TypeScript files`);
	} else if (verbose) {
		log(`  Loaded ${projectStats.tsFiles} TypeScript files in ${projectStats.loadTimeMs}ms`);
	}

	// Discover and analyze Svelte files
	if (verbose) log('Discovering Svelte files...');
	let svelteFiles = await discoverSvelteFiles(config, projectRoot);

	// Filter Svelte files in incremental mode
	if (changedFilesSet) {
		svelteFiles = svelteFiles.filter((f) => changedFilesSet.has(f));
		if (verbose) log(`  Filtered to ${svelteFiles.length} changed Svelte files`);
	} else if (verbose) {
		log(`  Found ${svelteFiles.length} Svelte files`);
	}

	if (verbose) log('Analyzing Svelte components...');
	const svelteAnalyses = await analyzeSvelteComponents(svelteFiles, projectRoot, verbose);

	// Create nodes
	if (verbose) log('Creating nodes...');
	const nodes = createGraphNodes(tsSourceFiles, svelteAnalyses, config, projectRoot);
	if (verbose) log(`  Created ${nodes.length} nodes`);

	// Create edges
	if (verbose) log('Creating edges...');
	const edges = createGraphEdges(nodes, tsSourceFiles, config, projectRoot);
	if (verbose) log(`  Created ${edges.length} edges`);

	// Get package names for stats
	const packageNames = [
		...new Set(nodes.map((n) => n.attributes.package).filter(Boolean)),
	] as string[];

	// Populate graph
	graph.nodes = nodes;
	graph.edges = edges;
	graph.metadata = {
		totalFiles: tsSourceFiles.length + svelteFiles.length,
		discoveryDurationMs: Math.round(performance.now() - startTime),
		packages: packageNames,
		gitCommit: getGitCommit(),
		gitBranch: getGitBranch(),
	};

	// Validate graph
	const validationResult = AKGGraphSchema.safeParse(graph);
	if (!validationResult.success) {
		logError(`Graph validation failed: ${JSON.stringify(validationResult.error.issues)}`);
	}

	// Write output (unless dry run)
	if (!options.dryRun) {
		await writeGraphOutput(graph, config, projectRoot, options.outputPath, verbose);
	}

	const stats: DiscoveryStats = {
		tsFiles: tsSourceFiles.length,
		svelteFiles: svelteFiles.length,
		totalNodes: nodes.length,
		totalEdges: edges.length,
		durationMs: Math.round(performance.now() - startTime),
		packages: packageNames,
	};

	return { graph, stats };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find the project root by looking for package.json
 */
function findProjectRoot(): string {
	let dir = process.cwd();
	while (dir !== '/') {
		if (existsSync(join(dir, 'package.json'))) {
			// Check if this is the monorepo root (has packages/)
			if (existsSync(join(dir, 'packages'))) {
				return dir;
			}
		}
		dir = dirname(dir);
	}
	return process.cwd();
}

/**
 * Discover Svelte files based on config patterns
 */
async function discoverSvelteFiles(config: AKGConfig, projectRoot: string): Promise<string[]> {
	const includePatterns = config.discovery?.include ?? [];
	const excludePatterns = config.discovery?.exclude ?? [];

	// Get Svelte-specific patterns
	const sveltePatterns = includePatterns.filter((p: string) => p.includes('.svelte'));

	const files: string[] = [];

	for (const pattern of sveltePatterns) {
		// Extract base directory from pattern
		const baseDir = pattern.split('**')[0].replace(/\/$/, '');
		const absoluteBase = resolve(projectRoot, baseDir);

		if (!existsSync(absoluteBase)) continue;

		// Recursively find .svelte files
		const found = await findFilesRecursive(absoluteBase, '.svelte');
		files.push(...found);
	}

	// Filter out excluded files
	const excludeRegexes = excludePatterns.map((p: string) => globToRegex(p));

	return files.filter((file: string) => {
		const relativePath = relative(projectRoot, file);
		return !excludeRegexes.some((regex: RegExp) => regex.test(relativePath));
	});
}

/**
 * Recursively find files with a given extension
 */
async function findFilesRecursive(dir: string, ext: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
				const subFiles = await findFilesRecursive(fullPath, ext);
				files.push(...subFiles);
			}
		} else if (entry.name.endsWith(ext)) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '<<<GLOBSTAR>>>')
		.replace(/\*/g, '[^/]*')
		.replace(/<<<GLOBSTAR>>>/g, '.*')
		.replace(/\?/g, '.');

	return new RegExp(escaped);
}

/**
 * Get current git commit hash
 */
function getGitCommit(): string | undefined {
	try {
		return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
	} catch {
		return undefined;
	}
}

/**
 * Get current git branch
 */
function getGitBranch(): string | undefined {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
	} catch {
		return undefined;
	}
}

/**
 * Get changed files between current HEAD and base branch
 */
function getChangedFiles(baseBranch: string, projectRoot: string): string[] {
	try {
		// Get files changed relative to base branch
		const output = execSync(`git diff --name-only ${baseBranch}...HEAD -- '*.ts' '*.svelte'`, {
			encoding: 'utf-8',
			cwd: projectRoot,
		}).trim();

		if (!output) return [];

		return output
			.split('\n')
			.filter((f) => f.length > 0)
			.map((f) => resolve(projectRoot, f));
	} catch {
		return [];
	}
}

/**
 * Filter source files to only include changed files
 */
function filterToChangedFiles<T extends { getFilePath(): string }>(
	sourceFiles: T[],
	changedFiles: Set<string>,
): T[] {
	return sourceFiles.filter((sf) => changedFiles.has(sf.getFilePath()));
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
	const args = process.argv.slice(2);
	const options: DiscoverOptions = {};

	// Parse arguments
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--config':
				options.configPath = args[++i];
				break;
			case '--output':
				options.outputPath = args[++i];
				break;
			case '--verbose':
			case '-v':
				options.verbose = true;
				break;
			case '--dry-run':
				options.dryRun = true;
				break;
			case '--incremental':
			case '-i':
				options.incremental = true;
				break;
			case '--base':
				options.baseBranch = args[++i];
				break;
			case '--help':
			case '-h':
				log(`
AKG Discovery CLI

Usage:
  bun run packages/web/src/tools/akg/cli/discover.ts [options]

Options:
  --config <path>   Path to akg.config.ts (default: auto-detect)
  --output <path>   Output path (default: from config)
  --verbose, -v     Enable verbose logging
  --dry-run         Analyze but don't write output
  --incremental, -i Only discover changed files (git diff)
  --base <branch>   Base branch for incremental (default: origin/main)
  --help, -h        Show this help
`);
				process.exit(0);
		}
	}

	log('AKG Discovery starting...');

	try {
		const { stats } = await discover(options);

		log('\nDiscovery complete!');
		log(`  TypeScript files: ${stats.tsFiles}`);
		log(`  Svelte files: ${stats.svelteFiles}`);
		log(`  Total nodes: ${stats.totalNodes}`);
		log(`  Total edges: ${stats.totalEdges}`);
		log(`  Packages: ${stats.packages.join(', ')}`);
		log(`  Duration: ${stats.durationMs}ms`);
	} catch (error) {
		logError(`Discovery failed: ${error}`);
		process.exit(1);
	}
}

// Run if executed directly
main();
