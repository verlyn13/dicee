/**
 * Project Setup Tests
 *
 * Unit tests for ts-morph project creation and utilities.
 */

import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import {
	addVirtualSourceFile,
	createMinimalProject,
	getExports,
	getImports,
	usesRunes,
} from '../../discovery/project.js';

// =============================================================================
// createMinimalProject Tests
// =============================================================================

describe('createMinimalProject', () => {
	it('should create a project without tsconfig', () => {
		const project = createMinimalProject();

		expect(project).toBeInstanceOf(Project);
	});

	it('should allow adding source files', () => {
		const project = createMinimalProject();

		const sourceFile = project.createSourceFile('test.ts', 'export const x = 1;');

		expect(sourceFile.getFilePath()).toContain('test.ts');
	});
});

// =============================================================================
// addVirtualSourceFile Tests
// =============================================================================

describe('addVirtualSourceFile', () => {
	it('should create a virtual source file', () => {
		const project = createMinimalProject();

		const sourceFile = addVirtualSourceFile(project, 'virtual.ts', 'const y = 2;');

		expect(sourceFile.getFullText()).toBe('const y = 2;');
	});

	it('should overwrite existing file with same path', () => {
		const project = createMinimalProject();

		addVirtualSourceFile(project, 'test.ts', 'const a = 1;');
		const sourceFile = addVirtualSourceFile(project, 'test.ts', 'const b = 2;');

		expect(sourceFile.getFullText()).toBe('const b = 2;');
	});
});

// =============================================================================
// getImports Tests
// =============================================================================

describe('getImports', () => {
	it('should extract named imports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `import { foo, bar } from './module';`);

		const imports = getImports(sourceFile);

		expect(imports).toHaveLength(1);
		expect(imports[0].moduleSpecifier).toBe('./module');
		expect(imports[0].namedImports).toHaveLength(2);
		expect(imports[0].namedImports[0].name).toBe('foo');
		expect(imports[0].namedImports[1].name).toBe('bar');
	});

	it('should extract default import', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `import Foo from './Foo';`);

		const imports = getImports(sourceFile);

		expect(imports).toHaveLength(1);
		expect(imports[0].defaultImport).toBe('Foo');
	});

	it('should extract namespace import', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `import * as Utils from './utils';`);

		const imports = getImports(sourceFile);

		expect(imports).toHaveLength(1);
		expect(imports[0].namespaceImport).toBe('Utils');
	});

	it('should detect type-only imports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `import type { Foo } from './types';`);

		const imports = getImports(sourceFile);

		expect(imports[0].isTypeOnly).toBe(true);
	});

	it('should extract line numbers', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile(
			'test.ts',
			`// comment
import { x } from './x';
import { y } from './y';`,
		);

		const imports = getImports(sourceFile);

		expect(imports[0].line).toBe(2);
		expect(imports[1].line).toBe(3);
	});
});

// =============================================================================
// getExports Tests
// =============================================================================

describe('getExports', () => {
	it('should extract function exports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `export function myFunction() {}`);

		const exports = getExports(sourceFile);

		expect(exports).toHaveLength(1);
		expect(exports[0].name).toBe('myFunction');
		expect(exports[0].kind).toBe('function');
	});

	it('should extract const exports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `export const MY_CONST = 42;`);

		const exports = getExports(sourceFile);

		expect(exports).toHaveLength(1);
		expect(exports[0].name).toBe('MY_CONST');
		expect(exports[0].kind).toBe('const');
	});

	it('should extract type exports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `export type MyType = string;`);

		const exports = getExports(sourceFile);

		expect(exports).toHaveLength(1);
		expect(exports[0].name).toBe('MyType');
		expect(exports[0].kind).toBe('type');
		expect(exports[0].isTypeOnly).toBe(true);
	});

	it('should extract interface exports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `export interface MyInterface {}`);

		const exports = getExports(sourceFile);

		expect(exports).toHaveLength(1);
		expect(exports[0].name).toBe('MyInterface');
		expect(exports[0].kind).toBe('interface');
	});

	it('should extract class exports', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `export class MyClass {}`);

		const exports = getExports(sourceFile);

		expect(exports).toHaveLength(1);
		expect(exports[0].name).toBe('MyClass');
		expect(exports[0].kind).toBe('class');
	});
});

// =============================================================================
// usesRunes Tests
// =============================================================================

describe('usesRunes', () => {
	it('should detect $state', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `let count = $state(0);`);

		expect(usesRunes(sourceFile)).toBe(true);
	});

	it('should detect $derived', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `let doubled = $derived(count * 2);`);

		expect(usesRunes(sourceFile)).toBe(true);
	});

	it('should detect $effect', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile(
			'test.ts',
			`$effect(() => { console.log(count); });`,
		);

		expect(usesRunes(sourceFile)).toBe(true);
	});

	it('should return false for regular code', () => {
		const project = createMinimalProject();
		const sourceFile = project.createSourceFile('test.ts', `const x = 1; function foo() {}`);

		expect(usesRunes(sourceFile)).toBe(false);
	});
});
