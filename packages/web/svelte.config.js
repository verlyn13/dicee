import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using Vercel adapter for deployment
		// See https://svelte.dev/docs/kit/adapter-vercel
		adapter: adapter({
			runtime: 'nodejs22.x',
		}),
	},
};

export default config;
