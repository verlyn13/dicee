<script lang="ts">
/**
 * Avatar - Procedurally generated user avatar using DiceBear
 *
 * Generates consistent avatars from a seed string (user ID or custom seed).
 * Supports multiple size variants for different UI contexts.
 *
 * Design: Neo-Brutalist with hard borders, no rounded corners
 */

import { identicon } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

interface Props {
	/** Seed for avatar generation (typically user ID) */
	seed: string;
	/** Size variant */
	size?: 'sm' | 'md' | 'lg' | 'xl';
	/** Optional alt text (defaults to "Avatar") */
	alt?: string;
	/** Additional CSS classes */
	class?: string;
}

let { seed, size = 'md', alt = 'Avatar', class: className = '' }: Props = $props();

/**
 * Generate avatar SVG data URL from seed
 */
const avatarUrl = $derived.by(() => {
	const avatar = createAvatar(identicon, {
		seed,
		// Neo-Brutalist: high contrast, geometric
		backgroundColor: ['#FAFAFA'],
		// Ensure consistent output
		randomizeIds: false,
	});

	const svg = avatar.toString();

	// Convert to data URL for inline display
	// Use Unicode-safe base64 encoding for SVG strings that may contain non-ASCII characters
	// encodeURIComponent converts to UTF-8 percent encoding
	// unescape converts percent encoding to Latin-1 bytes (what btoa expects)
	const base64 = btoa(unescape(encodeURIComponent(svg)));
	return `data:image/svg+xml;base64,${base64}`;
});

/**
 * Size mappings (in pixels)
 * Design spec: 40px, 64px, 128px, 256px
 */
const sizeMap = {
	sm: 40,
	md: 64,
	lg: 128,
	xl: 256,
} as const;

const pixelSize = $derived(sizeMap[size]);
</script>

<div class="avatar avatar--{size} {className}" role="img" aria-label={alt}>
	<img src={avatarUrl} alt={alt} width={pixelSize} height={pixelSize} />
</div>

<style>
	.avatar {
		/* Layout: Square container */
		display: inline-block;
		position: relative;
		flex-shrink: 0;

		/* Neo-Brutalist: Hard border, no rounded corners */
		border: var(--border-medium);
		background: var(--color-surface);

		/* Prevent image overflow */
		overflow: hidden;
	}

	.avatar img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Size variants */
	.avatar--sm {
		width: 40px;
		height: 40px;
	}

	.avatar--md {
		width: 64px;
		height: 64px;
	}

	.avatar--lg {
		width: 128px;
		height: 128px;
	}

	.avatar--xl {
		width: 256px;
		height: 256px;
	}

	/* Hover effect for interactive contexts */
	.avatar:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	/* Focus styles for accessibility */
	.avatar:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}
</style>
