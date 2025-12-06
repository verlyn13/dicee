import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: new URL('./src/lib', import.meta.url).pathname,
		},
		// Disable watch mode when run with --run or in CI
		watch: false,
	},
	resolve: {
		// Ensure we use browser version of Svelte
		conditions: ['browser'],
	},
});
