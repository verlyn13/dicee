<script lang="ts">
import favicon from '$lib/assets/favicon.svg';
import '$lib/styles/global.css';
import { onMount } from 'svelte';
import { afterNavigate, invalidate } from '$app/navigation';
import { preloadEngine } from '$lib/services/engine';
import {
	initializeTelemetry,
	setUserId,
	shutdownTelemetry,
	trackPageView,
} from '$lib/services/telemetry';
import { auth } from '$lib/stores/auth.svelte';

let { data, children } = $props();

// Track previous page for navigation tracking
let previousPage: string | null = null;

// Initialize auth store, telemetry, and preload WASM engine
onMount(() => {
	// Initialize telemetry first (before auth so we capture session start)
	initializeTelemetry({ enabled: true, debug: false });

	// Initialize auth with server-provided session data
	auth.init(data.supabase, data.session, data.user);

	// Set user ID if already authenticated
	if (data.user?.id) {
		setUserId(data.user.id);
	}

	// Listen for auth changes and invalidate the layout data
	const {
		data: { subscription },
	} = data.supabase.auth.onAuthStateChange((event, session) => {
		// Invalidate layout data when auth state changes
		// This ensures server and client stay in sync
		if (session?.expires_at !== data.session?.expires_at) {
			invalidate('supabase:auth');
		}

		// Update telemetry user ID on auth changes
		if (event === 'SIGNED_IN' && session?.user?.id) {
			setUserId(session.user.id);
		} else if (event === 'SIGNED_OUT') {
			setUserId(null);
		}
	});

	// Preload WASM engine for faster first-use
	preloadEngine();

	// Handle page unload for telemetry shutdown
	const handleBeforeUnload = () => {
		shutdownTelemetry();
	};
	window.addEventListener('beforeunload', handleBeforeUnload);

	return () => {
		subscription.unsubscribe();
		window.removeEventListener('beforeunload', handleBeforeUnload);
		shutdownTelemetry();
	};
});

// Track page views on navigation
afterNavigate(({ to }) => {
	if (to?.url?.pathname) {
		trackPageView(to.url.pathname, previousPage);
		previousPage = to.url.pathname;
	}
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
