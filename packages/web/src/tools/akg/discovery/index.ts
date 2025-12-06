/**
 * AKG Discovery Module Exports
 *
 * Re-exports all discovery functionality for the Architectural Knowledge Graph.
 */

// Edge factory
export {
	createAllEdgesForNode,
	createComponentUsageEdges,
	createImportEdges,
	createLayerMembershipEdges,
	createLayerRuleEdges,
	createServiceCallEdges,
	createSubscriptionEdges,
	createWASMCallEdges,
	type EdgeCreationOptions,
} from './edge-factory.js';
// Import analyzer
export {
	analyzeImports,
	filterLocalImports,
	filterTypeImports,
	filterValueImports,
	groupImportsByCategory,
	type ImportCategory,
	type ResolvedImport,
} from './import-analyzer.js';
// Node factory
export {
	createLayerNodes,
	createNodeFromSvelte,
	createNodeFromTS,
	createNodesFromSvelteFiles,
	createNodesFromTSFiles,
	createPackageNodes,
	getLayerForPath,
	type NodeCreationOptions,
} from './node-factory.js';
// Project setup
export {
	addVirtualSourceFile,
	createMinimalProject,
	createProject,
	getExports,
	getImports,
	type ProjectInitError,
	type ProjectInitResult,
	type ProjectResult,
	removeSourceFile,
	usesRunes,
} from './project.js';
// Svelte parser
export {
	addSvelteToProject,
	analyzeSvelteComponent,
	extractSvelteScripts,
	getSvelteImports,
	isSmartContainer,
	loadAndAnalyzeSvelteFile,
	removeSvelteFromProject,
	type SvelteAnalysis,
	type SvelteScripts,
	type SvelteTemplateInfo,
	usesRunes as svelteUsesRunes,
} from './svelte-parser.js';
