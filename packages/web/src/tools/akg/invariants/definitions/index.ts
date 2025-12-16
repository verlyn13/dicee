/**
 * Built-in Invariant Definitions
 *
 * Imports all built-in invariants to register them with the registry.
 * Import this module to enable all built-in checks.
 */

// Structural invariants
import './wasm-single-entry.js';
import './store-no-circular-deps.js';
import './layer-component-isolation.js';
import './service-layer-boundaries.js';
import './shared-isolation.js';

// Naming invariants
import './store-file-naming.js';
import './callback-prop-naming.js';

// Consistency invariants
import './type-schema-consistency.js';

// Protocol invariants
import './globallobby-uses-shared.js';
import './websocket-uses-shared-validation.js';

// Export list of built-in invariant IDs
export const BUILTIN_INVARIANTS = [
	'wasm_single_entry',
	'store_no_circular_deps',
	'layer_component_isolation',
	'service_layer_boundaries',
	'shared_isolation',
	'store_file_naming',
	'callback_prop_naming',
	'type_schema_consistency',
	'globallobby_uses_shared',
	'websocket_uses_shared_validation',
] as const;

export type BuiltinInvariantId = (typeof BUILTIN_INVARIANTS)[number];
