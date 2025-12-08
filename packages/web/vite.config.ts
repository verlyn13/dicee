import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
	plugins: [wasm(), sveltekit()],

	optimizeDeps: {
		exclude: ['dicee-engine'],
	},

	server: {
		// Enable network access for mobile testing
		host: true, // Listen on all network interfaces (0.0.0.0)
		port: 5173,
		strictPort: false, // Try next port if 5173 is busy

		// CORS for local network requests
		cors: true,

		// WebSocket for HMR over network
		hmr: {
			host: 'localhost', // Will be overridden by --host flag
		},

		// Proxy WebSocket routes to local Durable Objects worker
		// Run `pnpm dev:do` in a separate terminal first
		proxy: {
			'/ws': {
				target: 'http://localhost:8787',
				ws: true,
				changeOrigin: true,
			},
		},
	},

	build: {
		// Production optimizations
		target: 'es2020',
		sourcemap: true,
	},

	// Preview server (for testing production builds locally)
	preview: {
		host: true,
		port: 4173,
		strictPort: false,
		cors: true,
	},
});
