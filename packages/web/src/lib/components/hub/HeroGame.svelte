<script lang="ts">
/**
 * HeroGame - Animated dice hero card
 *
 * Primary entry point for solo play. Features animated rainbow dice
 * that respond to hover. Clicking navigates to solo game (no auth required).
 */

import { onDestroy, onMount } from 'svelte';
import { goto } from '$app/navigation';
import { haptic } from '$lib/utils/haptics';

// Dice state
interface DicePosition {
	x: number;
	y: number;
	rotation: number;
	scale: number;
	hue: number;
	value: number;
}

// Initial dice with random values
const initialDice: DicePosition[] = [
	{ x: 0, y: 0, rotation: 0, scale: 1, hue: 0, value: 1 },
	{ x: 0, y: 0, rotation: 0, scale: 1, hue: 60, value: 2 },
	{ x: 0, y: 0, rotation: 0, scale: 1, hue: 120, value: 3 },
	{ x: 0, y: 0, rotation: 0, scale: 1, hue: 180, value: 4 },
	{ x: 0, y: 0, rotation: 0, scale: 1, hue: 240, value: 5 },
];

let dicePositions = $state<DicePosition[]>(initialDice);
let isHovering = $state(false);
let isPressed = $state(false);
let animationFrame: number | null = null;
let startTime = 0;

// Placeholder for games played today - will be connected to real data
let gamesPlayedToday = $state(0);

// Cascade animation intensity
const cascadeIntensity = $derived(isHovering ? 1.5 : 1);
const cascadeSpeed = $derived(isHovering ? 1.8 : 1);

// Use requestAnimationFrame for smoother animation
function animate(timestamp: number) {
	if (!startTime) startTime = timestamp;
	const time = (timestamp - startTime) / 1000;

	dicePositions = dicePositions.map((pos, index) => {
		const offset = index * 0.8;
		// Enhanced cascade effect on hover
		const intensity = cascadeIntensity;
		const speed = cascadeSpeed;

		// Wave motion - more dramatic on hover
		const wavePhase = time * speed + offset;
		const floatX = Math.sin(wavePhase * 0.8) * 4 * intensity;
		const floatY = Math.cos(wavePhase * 0.6) * 3 * intensity;

		// Cascade effect - dice move in sequence
		const cascadeY = isHovering ? Math.sin(time * 3 + index * 0.5) * 6 : 0;

		// Rotation wobble
		const wobble = Math.sin(time * 2 * speed + offset) * (isHovering ? 0.08 : 0.02);

		return {
			...pos,
			x: floatX,
			y: floatY + cascadeY,
			rotation: wobble,
			scale: 1 + Math.sin(time * 0.5 * speed + offset) * (isHovering ? 0.08 : 0.03),
			// Rainbow cascade - faster on hover
			hue: (time * (isHovering ? 40 : 20) + index * 72) % 360,
		};
	});

	animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
	startTime = 0;
	animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
	if (animationFrame !== null) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}
}

onMount(() => {
	// Randomize initial dice values
	dicePositions = dicePositions.map((pos) => ({
		...pos,
		value: Math.floor(Math.random() * 6) + 1,
	}));
	startAnimation();
});

onDestroy(() => {
	stopAnimation();
});

function handleClick() {
	haptic('medium');
	// Navigate to game gateway for mode selection / solo play
	goto('/dicee');
}

function handleMouseDown() {
	isPressed = true;
	haptic('light');
}

function handleMouseUp() {
	isPressed = false;
}

// Computed style for each die
function getDieStyle(pos: DicePosition): string {
	const scale = isHovering ? pos.scale * 1.08 : pos.scale;
	const shadow = isHovering
		? '3px 3px 0px 0px rgba(24,24,27,0.4)'
		: '2px 2px 0px 0px rgba(24,24,27,0.2)';
	return `
		transform: translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}rad) scale(${scale});
		background-color: hsl(${pos.hue}, 75%, 97%);
		border-color: hsl(${pos.hue}, 70%, 35%);
		box-shadow: ${shadow};
	`;
}
</script>

<button
	class="hero-card"
	class:hovering={isHovering}
	class:pressed={isPressed}
	onclick={handleClick}
	onmouseenter={() => (isHovering = true)}
	onmouseleave={() => { isHovering = false; isPressed = false; }}
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
	ontouchstart={handleMouseDown}
	ontouchend={handleMouseUp}
	style="view-transition-name: hero-card"
>
	<!-- Title -->
	<div class="hero-title">
		<h1>DICEE</h1>
	</div>

	<!-- Dice Canvas -->
	<div class="dice-container">
		<div class="dice-row">
			{#each dicePositions as pos, i (i)}
				<div class="die" style={getDieStyle(pos)}>
					<span style="color: hsl({pos.hue}, 70%, 30%)">{pos.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- CTA Button -->
	<div class="hero-cta">
		<div class="cta-button">
			<span>PLAY NOW</span>
		</div>
	</div>

	<!-- Stats overlay -->
	<div class="hero-stats">
		<p>{gamesPlayedToday > 0 ? `${gamesPlayedToday} played today` : 'Start playing!'}</p>
	</div>
</button>

<style>
	.hero-card {
		width: 100%;
		height: 100%;
		border: var(--border-thick);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-brutal);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		overflow: hidden;
		position: relative;
		cursor: pointer;
	}

	.hero-card:hover {
		box-shadow: var(--shadow-brutal-lg);
		transform: translate(-2px, -2px);
	}

	.hero-card:active,
	.hero-card.pressed {
		box-shadow: 2px 2px 0 0 var(--color-text);
		transform: translate(2px, 2px);
	}

	/* Hover glow effect */
	.hero-card.hovering::before {
		content: '';
		position: absolute;
		inset: -2px;
		background: linear-gradient(
			45deg,
			hsl(0, 80%, 60%),
			hsl(60, 80%, 60%),
			hsl(120, 80%, 60%),
			hsl(180, 80%, 60%),
			hsl(240, 80%, 60%),
			hsl(300, 80%, 60%),
			hsl(360, 80%, 60%)
		);
		background-size: 400% 400%;
		animation: rainbow-border 3s linear infinite;
		z-index: -1;
		border-radius: calc(var(--radius-md) + 2px);
		opacity: 0.6;
	}

	@keyframes rainbow-border {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}

	.hero-title {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		z-index: 10;
	}

	.hero-title h1 {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		letter-spacing: var(--tracking-tight);
		margin: 0;
	}

	.dice-container {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dice-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
	}

	.die {
		width: 2rem;
		height: 2rem;
		border: 2px solid;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--transition-fast);
		will-change: transform;
	}

	.die span {
		font-family: var(--font-mono);
		font-size: var(--text-body);
	}

	@media (min-width: 768px) {
		.die {
			width: 3rem;
			height: 3rem;
		}

		.die span {
			font-size: var(--text-h3);
		}
	}

	.hero-cta {
		position: absolute;
		bottom: var(--space-3);
		right: var(--space-3);
		z-index: 10;
	}

	.cta-button {
		padding: var(--space-1) var(--space-3);
		background: var(--color-text);
		color: var(--color-surface);
		border: var(--border-thick);
		border-radius: var(--radius-sm);
		box-shadow: 2px 2px 0 0 rgba(24, 24, 27, 0.3);
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.hero-card:hover .cta-button {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.cta-button span {
		font-family: var(--font-mono);
		font-size: var(--text-small);
	}

	@media (min-width: 768px) {
		.cta-button span {
			font-size: var(--text-body);
		}
	}

	.hero-stats {
		position: absolute;
		bottom: var(--space-3);
		left: var(--space-3);
		z-index: 10;
	}

	.hero-stats p {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		margin: 0;
	}
</style>
