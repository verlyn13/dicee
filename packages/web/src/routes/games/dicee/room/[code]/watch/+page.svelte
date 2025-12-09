<script lang="ts">
/**
 * /games/dicee/room/[code]/watch - Redirect to unified route
 *
 * DEPRECATED: This route redirects to the main room route with ?mode=spectator.
 * All spectator functionality is now handled in the unified room page.
 */

import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';

const roomCode = $derived($page.params.code?.toUpperCase() ?? '');

onMount(() => {
	// Redirect to unified route with spectator mode
	goto(`/games/dicee/room/${roomCode}?mode=spectator`, { replaceState: true });
});
</script>

<div class="redirect-state">
	<p>Redirecting to spectator view...</p>
</div>

<style>
	.redirect-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-3);
		background: var(--color-background);
	}
</style>
