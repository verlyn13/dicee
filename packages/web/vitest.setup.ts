import '@testing-library/svelte/vitest';
import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

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
