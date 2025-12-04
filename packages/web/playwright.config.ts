import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Dicee
 *
 * Includes mobile device emulation for comprehensive testing.
 */
export default defineConfig({
	// Test directory
	testDir: './tests',

	// Run tests in files in parallel
	fullyParallel: true,

	// Fail the build on CI if you accidentally left test.only in the source code
	forbidOnly: !!process.env.CI,

	// Retry on CI only
	retries: process.env.CI ? 2 : 0,

	// Limit workers to prevent memory exhaustion
	// CI: 1 worker (sequential), Local: 2 workers max
	workers: process.env.CI ? 1 : 2,

	// Reporter to use
	reporter: process.env.CI ? 'github' : 'html',

	// Shared settings for all projects
	use: {
		// Base URL for tests
		baseURL: 'http://localhost:5173',

		// Collect trace when retrying the failed test
		trace: 'on-first-retry',

		// Screenshot on failure
		screenshot: 'only-on-failure',

		// Video on failure
		video: 'retain-on-failure',
	},

	// Configure projects for major browsers and devices
	// Local: Only Chrome for fast iteration. CI: Full matrix.
	projects: process.env.CI
		? [
				// Full CI matrix: Desktop + Mobile representative samples
				{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
				{ name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
				{ name: 'Desktop Safari', use: { ...devices['Desktop Safari'] } },
				{ name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
				{ name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
			]
		: [
				// Local development: Single browser for speed
				{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
			],

	// Run local dev server before starting tests
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000, // 2 minutes
	},
});
