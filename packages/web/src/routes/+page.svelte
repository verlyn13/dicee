<script lang="ts">
/**
 * / - Hub Landing Page
 *
 * The main entry point for Dicee. Shows the Hub grid layout with:
 * - HeroGame: Animated dice, starts solo play immediately
 * - AuthStatusCard: Guest/profile status with auth options
 * - LobbyGate: Quick code entry for multiplayer
 * - NewsDev: System status and updates
 */
import { Hub } from '$lib/components/hub/index.js';
</script>

<svelte:head>
	<title>Dicee - Probability Learning Game</title>
	<meta name="description" content="Learn probability through the classic dice game Yahtzee" />
</svelte:head>

<Hub />
