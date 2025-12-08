import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using Cloudflare Pages adapter for deployment
		// See https://svelte.dev/docs/kit/adapter-cloudflare
		adapter: adapter({
			// Routes are generated automatically based on +server.ts files
			routes: {
				// Include API routes and auth callback
				include: ['/*'],
				// Exclude static assets
				exclude: ['<all>'],
			},
		}),
	},
};

export default config;
