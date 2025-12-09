<!--
  SpectatorReactionContainer.svelte - Container for floating spectator reactions

  Listens for reaction events and displays them as floating emojis.
  Automatically removes reactions after animation completes.
-->
<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import {
	type SpectatorReactionEvent,
	spectatorService,
} from '$lib/services/spectatorService.svelte';
import SpectatorReactionFloat from './SpectatorReactionFloat.svelte';

interface Props {
	/** Maximum concurrent floating reactions */
	maxReactions?: number;
	/** Duration for each reaction animation */
	duration?: number;
	/** Whether to show spectator names on reactions */
	showNames?: boolean;
}

let { maxReactions = 15, duration = 2000, showNames = false }: Props = $props();

// Track active floating reactions
interface ActiveReaction extends SpectatorReactionEvent {
	key: string;
	position: { x: number; y: number };
}

let activeReactions = $state<ActiveReaction[]>([]);

// Listener for new reactions
function handleReaction(event: SpectatorReactionEvent) {
	// Generate unique key
	const key = `${event.reaction.id}-${Date.now()}`;

	// Random position within container width
	const position = {
		x: Math.random() * 200 - 100, // -100 to 100 from center
		y: 20, // Start 20px from bottom
	};

	// Add to active reactions
	const newReaction: ActiveReaction = {
		...event,
		key,
		position,
	};

	// Limit max reactions
	activeReactions = [...activeReactions.slice(-(maxReactions - 1)), newReaction];
}

// Remove reaction when animation completes
function removeReaction(key: string) {
	activeReactions = activeReactions.filter((r) => r.key !== key);
}

onMount(() => {
	spectatorService.addReactionListener(handleReaction);
});

onDestroy(() => {
	spectatorService.removeReactionListener(handleReaction);
});
</script>

<div class="spectator-reaction-container" aria-live="polite" aria-atomic="false">
	{#each activeReactions as reaction (reaction.key)}
		<SpectatorReactionFloat
			emoji={reaction.reaction.emoji}
			spectatorName={reaction.reaction.spectatorName}
			comboCount={reaction.comboCount}
			position={reaction.position}
			{duration}
			showName={showNames}
			onComplete={() => removeReaction(reaction.key)}
		/>
	{/each}
</div>

<style>
	.spectator-reaction-container {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 200px;
		pointer-events: none;
		overflow: hidden;
		z-index: 50;
	}
</style>
