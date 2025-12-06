/**
 * AKG Invariant Registry
 *
 * Maintains a registry of all available invariants.
 * Invariants are registered with their definitions and check functions.
 */

import type { Severity } from '../schema/graph.schema.js';
import type { InvariantCheckFn, InvariantDefinition } from '../schema/invariant.schema.js';

/**
 * Registered invariant with its check function
 */
export interface RegisteredInvariant {
	definition: InvariantDefinition;
	check: InvariantCheckFn;
}

/**
 * Invariant registry singleton
 */
class InvariantRegistry {
	private invariants = new Map<string, RegisteredInvariant>();

	/**
	 * Register an invariant
	 */
	register(definition: InvariantDefinition, check: InvariantCheckFn): void {
		if (this.invariants.has(definition.id)) {
			throw new Error(`Invariant '${definition.id}' is already registered`);
		}
		this.invariants.set(definition.id, { definition, check });
	}

	/**
	 * Get an invariant by ID
	 */
	get(id: string): RegisteredInvariant | undefined {
		return this.invariants.get(id);
	}

	/**
	 * Get all registered invariants
	 */
	getAll(): RegisteredInvariant[] {
		return [...this.invariants.values()];
	}

	/**
	 * Get all invariant IDs
	 */
	getIds(): string[] {
		return [...this.invariants.keys()];
	}

	/**
	 * Check if an invariant is registered
	 */
	has(id: string): boolean {
		return this.invariants.has(id);
	}

	/**
	 * Get invariants by category
	 */
	getByCategory(category: InvariantDefinition['category']): RegisteredInvariant[] {
		return this.getAll().filter((inv) => inv.definition.category === category);
	}

	/**
	 * Get enabled invariants (respecting enabledByDefault)
	 */
	getEnabled(enable?: string[], disable?: string[]): RegisteredInvariant[] {
		const enableSet = new Set(enable ?? []);
		const disableSet = new Set(disable ?? []);

		return this.getAll().filter((inv) => {
			const def = inv.definition;

			// Explicitly disabled
			if (disableSet.has(def.id)) {
				return false;
			}

			// Explicitly enabled
			if (enableSet.has(def.id)) {
				return true;
			}

			// Use default
			return def.enabledByDefault;
		});
	}

	/**
	 * Clear all registered invariants (for testing)
	 */
	clear(): void {
		this.invariants.clear();
	}

	/**
	 * Get count of registered invariants
	 */
	get size(): number {
		return this.invariants.size;
	}
}

// Global registry instance
export const registry = new InvariantRegistry();

/**
 * Helper function to define an invariant
 */
export function defineInvariant(
	definition: Omit<InvariantDefinition, 'enabledByDefault' | 'fixable'> & {
		enabledByDefault?: boolean;
		fixable?: boolean;
	},
	check: InvariantCheckFn,
): void {
	const fullDefinition: InvariantDefinition = {
		enabledByDefault: true,
		fixable: false,
		...definition,
	};
	registry.register(fullDefinition, check);
}

/**
 * Decorator-style helper for creating invariants
 */
export function createInvariant(
	id: string,
	name: string,
	options: {
		description: string;
		category: InvariantDefinition['category'];
		severity: Severity;
		businessRule: string;
		enabledByDefault?: boolean;
		fixable?: boolean;
		include?: string[];
		exclude?: string[];
		docsUrl?: string;
	},
): (check: InvariantCheckFn) => void {
	return (check: InvariantCheckFn) => {
		defineInvariant(
			{
				id,
				name,
				...options,
			},
			check,
		);
	};
}

/**
 * Get the global registry
 */
export function getRegistry(): InvariantRegistry {
	return registry;
}
