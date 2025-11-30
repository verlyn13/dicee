/// <reference types="@testing-library/jest-dom" />

import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
	interface Assertion<T = unknown> extends AxeMatchers {}
	interface AsymmetricMatchersContaining extends AxeMatchers {}
}
