import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		svelte({
			hot: false,
			// Force client-side compilation for tests
			compilerOptions: {
				hydratable: true,
			},
		}),
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: new URL('./src/lib', import.meta.url).pathname,
		},
	},
	resolve: {
		// Ensure we use browser version of Svelte
		conditions: ['browser'],
	},
});
