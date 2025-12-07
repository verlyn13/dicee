import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.integration.test.ts'],
		environment: 'node',
		globals: true,
		testTimeout: 30000, // Integration tests need more time
		hookTimeout: 30000,
		pool: 'forks', // Better isolation for worker tests
		poolOptions: {
			forks: {
				singleFork: true, // Run sequentially to avoid port conflicts
			},
		},
	},
});
