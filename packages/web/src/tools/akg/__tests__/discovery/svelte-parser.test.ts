/**
 * Svelte Parser Tests
 *
 * Unit tests for Svelte 5 component parsing and script extraction.
 */

import { describe, expect, it } from 'vitest';
import {
	analyzeSvelteComponent,
	extractSvelteScripts,
	isSmartContainer,
	usesRunes,
} from '../../discovery/svelte-parser.js';

// =============================================================================
// extractSvelteScripts Tests
// =============================================================================

describe('extractSvelteScripts', () => {
	it('should extract instance script', () => {
		const code = `
<script lang="ts">
  let count = 0;
</script>
<button>{count}</button>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.instance).toContain('let count = 0;');
		expect(scripts.module).toBeNull();
		expect(scripts.lang).toBe('ts');
	});

	it('should extract module script', () => {
		const code = `
<script module>
  export const metadata = { title: 'Test' };
</script>
<script lang="ts">
  let x = 1;
</script>
<div>{x}</div>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.module).toContain('export const metadata');
		expect(scripts.instance).toContain('let x = 1');
	});

	it('should handle component with no script', () => {
		const code = `<div>Static content</div>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.instance).toBeNull();
		expect(scripts.module).toBeNull();
	});

	it('should calculate correct start lines', () => {
		const code = `<!-- comment -->
<script lang="ts">
  let count = 0;
</script>
<button>{count}</button>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.instanceStartLine).toBe(2);
	});
});

// =============================================================================
// analyzeSvelteComponent Tests
// =============================================================================

describe('analyzeSvelteComponent', () => {
	it('should detect component usage in template', () => {
		const code = `
<script lang="ts">
  import Button from './Button.svelte';
</script>
<Button label="Click me" />`;

		const analysis = analyzeSvelteComponent(code, 'test.svelte');

		expect(analysis.template.componentUsages).toHaveLength(1);
		expect(analysis.template.componentUsages[0].name).toBe('Button');
		expect(analysis.template.componentUsages[0].props).toContain('label');
	});

	it('should detect multiple component usages', () => {
		const code = `
<script lang="ts">
  import Header from './Header.svelte';
  import Footer from './Footer.svelte';
</script>
<Header />
<main>Content</main>
<Footer />`;

		const analysis = analyzeSvelteComponent(code, 'test.svelte');

		expect(analysis.template.componentUsages).toHaveLength(2);
		expect(analysis.template.componentUsages.map((c) => c.name)).toEqual(['Header', 'Footer']);
	});

	it('should detect slots', () => {
		const code = `
<div class="container">
  <slot />
</div>`;

		const analysis = analyzeSvelteComponent(code, 'test.svelte');

		expect(analysis.template.hasSlots).toBe(true);
	});

	it('should return AST for advanced analysis', () => {
		const code = `<script>let x = 1;</script><div>{x}</div>`;

		const analysis = analyzeSvelteComponent(code, 'test.svelte');

		expect(analysis.ast).toBeDefined();
		expect(analysis.ast.instance).toBeDefined();
	});
});

// =============================================================================
// isSmartContainer Tests
// =============================================================================

describe('isSmartContainer', () => {
	it('should detect store imports', () => {
		const scripts = {
			instance: `import { gameStore } from '$lib/stores/game.svelte';`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(isSmartContainer(scripts)).toBe(true);
	});

	it('should detect service imports', () => {
		const scripts = {
			instance: `import { authService } from '$lib/services/auth';`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(isSmartContainer(scripts)).toBe(true);
	});

	it('should detect .svelte.ts imports', () => {
		const scripts = {
			instance: `import { counter } from './counter.svelte.ts';`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(isSmartContainer(scripts)).toBe(true);
	});

	it('should return false for dumb components', () => {
		const scripts = {
			instance: `import { Button } from '$lib/components/ui';`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(isSmartContainer(scripts)).toBe(false);
	});

	it('should check module script as well', () => {
		const scripts = {
			instance: `let x = 1;`,
			module: `import { store } from '$lib/stores/app';`,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: 1,
		};

		expect(isSmartContainer(scripts)).toBe(true);
	});
});

// =============================================================================
// usesRunes Tests
// =============================================================================

describe('usesRunes (svelte)', () => {
	it('should detect $state', () => {
		const scripts = {
			instance: `let count = $state(0);`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(usesRunes(scripts)).toBe(true);
	});

	it('should detect $derived', () => {
		const scripts = {
			instance: `let doubled = $derived(count * 2);`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(usesRunes(scripts)).toBe(true);
	});

	it('should detect $effect', () => {
		const scripts = {
			instance: `$effect(() => { document.title = title; });`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(usesRunes(scripts)).toBe(true);
	});

	it('should detect $props', () => {
		const scripts = {
			instance: `let { name, value = 0 } = $props();`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(usesRunes(scripts)).toBe(true);
	});

	it('should return false for Svelte 4 style', () => {
		const scripts = {
			instance: `export let name; let count = 0;`,
			module: null,
			lang: 'ts' as const,
			instanceStartLine: 1,
			moduleStartLine: null,
		};

		expect(usesRunes(scripts)).toBe(false);
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
	it('should handle empty script', () => {
		const code = `<script></script><div></div>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		// Empty script content might be empty string or null depending on parser
		expect(scripts.instance === '' || scripts.instance === null).toBe(true);
	});

	it('should handle TypeScript generics in script', () => {
		const code = `
<script lang="ts">
  function identity<T>(arg: T): T { return arg; }
</script>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.instance).toContain('<T>');
	});

	it('should handle script with complex imports', () => {
		const code = `
<script lang="ts">
  import type { Config } from './types';
  import { default as Component, type Props } from './Component.svelte';
  import * as Utils from './utils';
</script>`;

		const scripts = extractSvelteScripts(code, 'test.svelte');

		expect(scripts.instance).toContain('import type');
		expect(scripts.instance).toContain('import * as');
	});
});
