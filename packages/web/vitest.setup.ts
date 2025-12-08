import '@testing-library/svelte/vitest';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

// Extend with jest-dom matchers
expect.extend(jestDomMatchers);

// Extend with vitest-axe matchers
expect.extend(matchers);

/**
 * Polyfill Canvas API for jsdom
 *
 * DiceBear avatars use canvas for rendering. jsdom doesn't implement
 * HTMLCanvasElement.getContext(), so we provide a minimal mock.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
	HTMLCanvasElement.prototype.getContext = vi.fn(
		() => null,
	) as unknown as HTMLCanvasElement['getContext'];
}
