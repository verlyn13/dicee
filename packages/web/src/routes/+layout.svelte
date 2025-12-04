<script lang="ts">
import favicon from '$lib/assets/favicon.svg';
import '$lib/styles/global.css';
import { onMount } from 'svelte';
import { invalidate } from '$app/navigation';
import { preloadEngine } from '$lib/services/engine';
import { auth } from '$lib/stores/auth.svelte';

let { data, children } = $props();

// Initialize auth store and preload WASM engine
onMount(() => {
	// Initialize auth with server-provided session data
	auth.init(data.supabase, data.session, data.user);

	// Listen for auth changes and invalidate the layout data
	const {
		data: { subscription },
	} = data.supabase.auth.onAuthStateChange((event, session) => {
		// Invalidate layout data when auth state changes
		// This ensures server and client stay in sync
		if (session?.expires_at !== data.session?.expires_at) {
			invalidate('supabase:auth');
		}
	});

	// Preload WASM engine for faster first-use
	preloadEngine();

	return () => {
		subscription.unsubscribe();
	};
});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}
