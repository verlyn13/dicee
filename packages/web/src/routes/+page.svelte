<script lang="ts">
/**
 * / - Lobby Landing Page
 *
 * The main entry point for Dicee. Shows the global lobby with:
 * - Live room browser
 * - Global chat
 * - Online presence indicator
 * - Quick actions: Create room, Solo play
 */
import { LobbyLanding } from '$lib/components/lobby/index.js';
</script>

<svelte:head>
	<title>Dicee - Probability Learning Game</title>
	<meta name="description" content="Learn probability through the classic dice game Yahtzee" />
</svelte:head>

<LobbyLanding />
