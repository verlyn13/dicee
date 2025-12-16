/**
 * SARIF Output for AKG
 *
 * Converts AKG check results to SARIF 2.1.0 format for GitHub Code Scanning
 * and other static analysis tools.
 *
 * @see https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 * @see https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
 */

import { getRegistry } from '../invariants/registry.js';
import type { Severity } from '../schema/graph.schema.js';
import type {
	CheckSummary,
	InvariantViolation,
	ViolationEvidence,
} from '../schema/invariant.schema.js';

// =============================================================================
// SARIF Types (subset of SARIF 2.1.0 schema)
// =============================================================================

/**
 * SARIF log - top-level container
 */
export interface SarifLog {
	$schema: string;
	version: '2.1.0';
	runs: SarifRun[];
}

/**
 * SARIF run - represents a single invocation of an analysis tool
 */
export interface SarifRun {
	tool: SarifTool;
	results: SarifResult[];
	invocations?: SarifInvocation[];
}

/**
 * SARIF tool - describes the analysis tool
 */
export interface SarifTool {
	driver: SarifToolComponent;
}

/**
 * SARIF tool component - driver or extension
 */
export interface SarifToolComponent {
	name: string;
	version: string;
	informationUri?: string;
	rules: SarifReportingDescriptor[];
}

/**
 * SARIF reporting descriptor - describes a rule
 */
export interface SarifReportingDescriptor {
	id: string;
	name: string;
	shortDescription: SarifMultiformatMessageString;
	fullDescription?: SarifMultiformatMessageString;
	helpUri?: string;
	defaultConfiguration?: SarifReportingConfiguration;
	properties?: Record<string, unknown>;
}

/**
 * SARIF multiformat message string
 */
export interface SarifMultiformatMessageString {
	text: string;
	markdown?: string;
}

/**
 * SARIF reporting configuration
 */
export interface SarifReportingConfiguration {
	level: SarifLevel;
	enabled?: boolean;
}

/**
 * SARIF level - severity level for a result
 */
export type SarifLevel = 'none' | 'note' | 'warning' | 'error';

/**
 * SARIF result - a single finding
 */
export interface SarifResult {
	ruleId: string;
	ruleIndex?: number;
	level: SarifLevel;
	message: SarifMessage;
	locations?: SarifLocation[];
	fixes?: SarifFix[];
	relatedLocations?: SarifLocation[];
	properties?: Record<string, unknown>;
}

/**
 * SARIF message
 */
export interface SarifMessage {
	text: string;
	markdown?: string;
	arguments?: string[];
}

/**
 * SARIF location
 */
export interface SarifLocation {
	physicalLocation?: SarifPhysicalLocation;
	message?: SarifMessage;
}

/**
 * SARIF physical location
 */
export interface SarifPhysicalLocation {
	artifactLocation: SarifArtifactLocation;
	region?: SarifRegion;
	contextRegion?: SarifRegion;
}

/**
 * SARIF artifact location
 */
export interface SarifArtifactLocation {
	uri: string;
	uriBaseId?: string;
}

/**
 * SARIF region
 */
export interface SarifRegion {
	startLine?: number;
	startColumn?: number;
	endLine?: number;
	endColumn?: number;
	snippet?: SarifArtifactContent;
}

/**
 * SARIF artifact content
 */
export interface SarifArtifactContent {
	text: string;
}

/**
 * SARIF fix - suggested fix for a result
 */
export interface SarifFix {
	description: SarifMessage;
	artifactChanges: SarifArtifactChange[];
}

/**
 * SARIF artifact change
 */
export interface SarifArtifactChange {
	artifactLocation: SarifArtifactLocation;
	replacements: SarifReplacement[];
}

/**
 * SARIF replacement
 */
export interface SarifReplacement {
	deletedRegion: SarifRegion;
	insertedContent?: SarifArtifactContent;
}

/**
 * SARIF invocation - details about tool execution
 */
export interface SarifInvocation {
	executionSuccessful: boolean;
	startTimeUtc?: string;
	endTimeUtc?: string;
	exitCode?: number;
	toolExecutionNotifications?: SarifNotification[];
}

/**
 * SARIF notification
 */
export interface SarifNotification {
	message: SarifMessage;
	level: SarifLevel;
}

// =============================================================================
// Conversion Options
// =============================================================================

/**
 * Options for SARIF conversion
 */
export interface SarifOptions {
	/** Tool version (default: '1.0.0') */
	toolVersion?: string;
	/** Information URI for the tool */
	informationUri?: string;
	/** Base URI for artifact locations */
	uriBaseId?: string;
	/** Include invocation details */
	includeInvocation?: boolean;
	/** Start time of the check */
	startTime?: string;
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert AKG severity to SARIF level
 */
function severityToLevel(severity: Severity): SarifLevel {
	switch (severity) {
		case 'error':
			return 'error';
		case 'warning':
			return 'warning';
		case 'info':
			return 'note';
		default:
			return 'warning';
	}
}

/**
 * Convert violation evidence to SARIF location
 */
function evidenceToLocation(evidence: ViolationEvidence, uriBaseId?: string): SarifLocation {
	const location: SarifLocation = {
		physicalLocation: {
			artifactLocation: {
				uri: evidence.filePath,
				...(uriBaseId && { uriBaseId }),
			},
			region: {
				startLine: evidence.line,
				...(evidence.column && { startColumn: evidence.column }),
				...(evidence.endLine && { endLine: evidence.endLine }),
				...(evidence.endColumn && { endColumn: evidence.endColumn }),
				...(evidence.snippet && { snippet: { text: evidence.snippet } }),
			},
		},
	};

	return location;
}

/**
 * Generate a synthetic location when no evidence is available.
 * GitHub Code Scanning requires at least one location per result.
 */
function createSyntheticLocation(violation: InvariantViolation, uriBaseId?: string): SarifLocation {
	// Use a fallback path that indicates this is an architectural issue
	// The actual source node info is preserved in the location message and result properties
	return {
		physicalLocation: {
			artifactLocation: {
				uri: 'docs/architecture/akg/README.md',
				...(uriBaseId && { uriBaseId }),
			},
			region: {
				startLine: 1,
			},
		},
		message: {
			text: `Source: ${violation.sourceNode}${violation.targetNode ? `, Target: ${violation.targetNode}` : ''}`,
		},
	};
}

/**
 * Convert a violation to a SARIF result
 */
function violationToResult(
	violation: InvariantViolation,
	ruleIndex: number,
	uriBaseId?: string,
): SarifResult {
	const result: SarifResult = {
		ruleId: violation.invariantId,
		ruleIndex,
		level: severityToLevel(violation.severity),
		message: {
			text: violation.message,
			...(violation.suggestion && {
				markdown: `${violation.message}\n\n**Suggestion:** ${violation.suggestion}`,
			}),
		},
	};

	// Add locations from evidence, or create synthetic location for SARIF compliance
	if (violation.evidence.length > 0) {
		result.locations = violation.evidence.map((e) => evidenceToLocation(e, uriBaseId));
	} else {
		// GitHub Code Scanning requires at least one location per result
		result.locations = [createSyntheticLocation(violation, uriBaseId)];
	}

	// Add context as properties
	if (violation.context || violation.businessRule) {
		result.properties = {
			...(violation.businessRule && { businessRule: violation.businessRule }),
			...(violation.sourceNode && { sourceNode: violation.sourceNode }),
			...(violation.targetNode && { targetNode: violation.targetNode }),
			...violation.context,
		};
	}

	return result;
}

/**
 * Build SARIF rules from registered invariants
 */
function buildRules(): SarifReportingDescriptor[] {
	const registry = getRegistry();
	const invariants = registry.getAll();

	return invariants.map((inv) => {
		const def = inv.definition;
		return {
			id: def.id,
			name: def.name,
			shortDescription: { text: def.description.slice(0, 100) },
			fullDescription: { text: def.description },
			...(def.docsUrl && { helpUri: def.docsUrl }),
			defaultConfiguration: {
				level: severityToLevel(def.severity),
				enabled: def.enabledByDefault,
			},
			properties: {
				category: def.category,
				businessRule: def.businessRule,
				fixable: def.fixable,
			},
		};
	});
}

/**
 * Create a rule ID to index map for efficient lookups
 */
function buildRuleIndexMap(rules: SarifReportingDescriptor[]): Map<string, number> {
	const map = new Map<string, number>();
	rules.forEach((rule, index) => {
		map.set(rule.id, index);
	});
	return map;
}

/**
 * Convert CheckSummary to SARIF log
 */
export function toSarif(summary: CheckSummary, options: SarifOptions = {}): SarifLog {
	const toolVersion = options.toolVersion ?? '1.0.0';
	const informationUri = options.informationUri ?? 'https://github.com/dicee/docs/architecture/akg';

	// Build rules from registered invariants
	const rules = buildRules();
	const ruleIndexMap = buildRuleIndexMap(rules);

	// Convert all violations to results
	const results: SarifResult[] = [];
	for (const checkResult of summary.results) {
		for (const violation of checkResult.violations) {
			const ruleIndex = ruleIndexMap.get(violation.invariantId) ?? -1;
			results.push(violationToResult(violation, ruleIndex, options.uriBaseId));
		}
	}

	// Build the SARIF log
	const sarifLog: SarifLog = {
		$schema:
			'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
		version: '2.1.0',
		runs: [
			{
				tool: {
					driver: {
						name: 'AKG',
						version: toolVersion,
						informationUri,
						rules,
					},
				},
				results,
			},
		],
	};

	// Add invocation if requested
	if (options.includeInvocation) {
		const exitSuccessful = summary.exitCode === 'success';
		sarifLog.runs[0].invocations = [
			{
				executionSuccessful: exitSuccessful,
				...(options.startTime && { startTimeUtc: options.startTime }),
				endTimeUtc: summary.timestamp,
				exitCode: exitSuccessful ? 0 : summary.exitCode === 'warnings' ? 0 : 1,
			},
		];
	}

	return sarifLog;
}

/**
 * Convert CheckSummary to SARIF JSON string
 */
export function toSarifString(summary: CheckSummary, options: SarifOptions = {}): string {
	const sarif = toSarif(summary, options);
	return JSON.stringify(sarif, null, 2);
}

/**
 * Validate that a SARIF log has the required structure
 */
export function validateSarif(sarif: unknown): sarif is SarifLog {
	if (typeof sarif !== 'object' || sarif === null) return false;

	const log = sarif as Record<string, unknown>;
	if (log.version !== '2.1.0') return false;
	if (!Array.isArray(log.runs)) return false;
	if (log.runs.length === 0) return false;

	const run = log.runs[0] as Record<string, unknown>;
	if (!run.tool || typeof run.tool !== 'object') return false;
	if (!Array.isArray(run.results)) return false;

	return true;
}
