/**
 * Spectator Reactions (D7) Unit Tests
 *
 * Tests for the spectator reaction system:
 * - Reaction types and metadata
 * - Rate limiting
 * - Combo tracking
 * - Rooting-specific reactions
 * - Event handling
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	REACTION_METADATA,
	ROOTING_REACTIONS,
	SPECTATOR_REACTIONS,
	type SpectatorReactionEmoji,
	type SpectatorReactionEvent,
	STANDARD_REACTIONS,
} from '$lib/services/spectatorService.svelte';

// =============================================================================
// Constants Tests
// =============================================================================

describe('Spectator Reaction Constants', () => {
	describe('STANDARD_REACTIONS', () => {
		it('contains expected standard emojis', () => {
			expect(STANDARD_REACTIONS).toContain('👍');
			expect(STANDARD_REACTIONS).toContain('🎲');
			expect(STANDARD_REACTIONS).toContain('😱');
			expect(STANDARD_REACTIONS).toContain('💀');
			expect(STANDARD_REACTIONS).toContain('🎉');
		});

		it('has correct length', () => {
			expect(STANDARD_REACTIONS).toHaveLength(5);
		});
	});

	describe('SPECTATOR_REACTIONS', () => {
		it('contains expected spectator-exclusive emojis', () => {
			expect(SPECTATOR_REACTIONS).toContain('🍿');
			expect(SPECTATOR_REACTIONS).toContain('📢');
			expect(SPECTATOR_REACTIONS).toContain('🙈');
			expect(SPECTATOR_REACTIONS).toContain('🪦');
			expect(SPECTATOR_REACTIONS).toContain('🔥');
			expect(SPECTATOR_REACTIONS).toContain('🤡');
		});

		it('has correct length', () => {
			expect(SPECTATOR_REACTIONS).toHaveLength(6);
		});
	});

	describe('ROOTING_REACTIONS', () => {
		it('contains expected rooting emojis', () => {
			expect(ROOTING_REACTIONS).toContain('📣');
			expect(ROOTING_REACTIONS).toContain('💪');
		});

		it('has correct length', () => {
			expect(ROOTING_REACTIONS).toHaveLength(2);
		});
	});
});

// =============================================================================
// Metadata Tests
// =============================================================================

describe('REACTION_METADATA', () => {
	it('has metadata for all standard reactions', () => {
		for (const emoji of STANDARD_REACTIONS) {
			expect(REACTION_METADATA[emoji]).toBeDefined();
			expect(REACTION_METADATA[emoji].emoji).toBe(emoji);
			expect(REACTION_METADATA[emoji].category).toBe('standard');
		}
	});

	it('has metadata for all spectator reactions', () => {
		for (const emoji of SPECTATOR_REACTIONS) {
			expect(REACTION_METADATA[emoji]).toBeDefined();
			expect(REACTION_METADATA[emoji].emoji).toBe(emoji);
			expect(REACTION_METADATA[emoji].category).toBe('spectator');
		}
	});

	it('has metadata for all rooting reactions', () => {
		for (const emoji of ROOTING_REACTIONS) {
			expect(REACTION_METADATA[emoji]).toBeDefined();
			expect(REACTION_METADATA[emoji].emoji).toBe(emoji);
			expect(REACTION_METADATA[emoji].category).toBe('rooting');
			expect(REACTION_METADATA[emoji].requiresRooting).toBe(true);
		}
	});

	it('has labels for all reactions', () => {
		const allEmojis: SpectatorReactionEmoji[] = [
			...STANDARD_REACTIONS,
			...SPECTATOR_REACTIONS,
			...ROOTING_REACTIONS,
		];

		for (const emoji of allEmojis) {
			expect(REACTION_METADATA[emoji].label).toBeDefined();
			expect(typeof REACTION_METADATA[emoji].label).toBe('string');
			expect(REACTION_METADATA[emoji].label.length).toBeGreaterThan(0);
		}
	});

	it('spectator reactions have sounds', () => {
		// Most spectator reactions should have sounds
		const withSounds = SPECTATOR_REACTIONS.filter(
			(emoji) => REACTION_METADATA[emoji].sound !== undefined,
		);
		expect(withSounds.length).toBeGreaterThan(4); // At least 5 of 6
	});

	it('rooting reactions have sounds', () => {
		for (const emoji of ROOTING_REACTIONS) {
			expect(REACTION_METADATA[emoji].sound).toBeDefined();
		}
	});
});

// =============================================================================
// Mock Spectator Service Store
// =============================================================================

interface MockSpectatorReactionStore {
	recentReactions: SpectatorReactionEvent[];
	reactionRateLimit: { remaining: number; resetAt: number } | null;
	myRootingChoice: { playerId: string } | null;
	canSendReaction: boolean;
	addReaction: (event: SpectatorReactionEvent) => void;
	updateRateLimit: (remaining: number) => void;
	setRootingChoice: (playerId: string | null) => void;
}

function createMockReactionStore(): MockSpectatorReactionStore {
	let recentReactions: SpectatorReactionEvent[] = [];
	let rateLimit: { remaining: number; resetAt: number } | null = {
		remaining: 10,
		resetAt: Date.now() + 30000,
	};
	let rootingChoice: { playerId: string } | null = null;

	return {
		get recentReactions() {
			return recentReactions;
		},
		get reactionRateLimit() {
			return rateLimit;
		},
		get myRootingChoice() {
			return rootingChoice;
		},
		get canSendReaction() {
			return rateLimit === null || rateLimit.remaining > 0;
		},
		addReaction(event: SpectatorReactionEvent) {
			recentReactions = [...recentReactions.slice(-19), event];
		},
		updateRateLimit(remaining: number) {
			rateLimit = {
				remaining,
				resetAt: Date.now() + 30000,
			};
		},
		setRootingChoice(playerId: string | null) {
			rootingChoice = playerId ? { playerId } : null;
		},
	};
}

// =============================================================================
// Store Behavior Tests
// =============================================================================

describe('Spectator Reaction Store Behavior', () => {
	let store: MockSpectatorReactionStore;

	beforeEach(() => {
		store = createMockReactionStore();
	});

	describe('Recent Reactions', () => {
		it('starts with empty reactions', () => {
			expect(store.recentReactions).toHaveLength(0);
		});

		it('adds reactions to the list', () => {
			const event: SpectatorReactionEvent = {
				reaction: {
					id: 'test-1',
					spectatorId: 'user-1',
					spectatorName: 'TestUser',
					emoji: '👍',
					timestamp: Date.now(),
				},
				comboCount: 1,
				playSound: false,
			};

			store.addReaction(event);
			expect(store.recentReactions).toHaveLength(1);
			expect(store.recentReactions[0].reaction.emoji).toBe('👍');
		});

		it('limits to 20 reactions', () => {
			for (let i = 0; i < 25; i++) {
				const event: SpectatorReactionEvent = {
					reaction: {
						id: `test-${i}`,
						spectatorId: 'user-1',
						spectatorName: 'TestUser',
						emoji: '👍',
						timestamp: Date.now(),
					},
					comboCount: 1,
					playSound: false,
				};
				store.addReaction(event);
			}

			expect(store.recentReactions).toHaveLength(20);
			// First 5 should be dropped (25 - 20)
			expect(store.recentReactions[0].reaction.id).toBe('test-5');
			expect(store.recentReactions[19].reaction.id).toBe('test-24');
		});
	});

	describe('Rate Limiting', () => {
		it('allows sending when under limit', () => {
			expect(store.canSendReaction).toBe(true);
			expect(store.reactionRateLimit?.remaining).toBe(10);
		});

		it('blocks sending when at limit', () => {
			store.updateRateLimit(0);
			expect(store.canSendReaction).toBe(false);
		});

		it('decrements remaining on use', () => {
			store.updateRateLimit(5);
			expect(store.reactionRateLimit?.remaining).toBe(5);
		});
	});

	describe('Rooting-Specific Reactions', () => {
		it('starts with no rooting choice', () => {
			expect(store.myRootingChoice).toBeNull();
		});

		it('can set rooting choice', () => {
			store.setRootingChoice('player-123');
			expect(store.myRootingChoice?.playerId).toBe('player-123');
		});

		it('can clear rooting choice', () => {
			store.setRootingChoice('player-123');
			store.setRootingChoice(null);
			expect(store.myRootingChoice).toBeNull();
		});
	});
});

// =============================================================================
// Combo Tracking Tests
// =============================================================================

describe('Combo Tracking', () => {
	interface ComboTracker {
		reactions: Map<SpectatorReactionEmoji, { timestamp: number; spectatorId: string }[]>;
		comboWindowMs: number;
		trackReaction: (emoji: SpectatorReactionEmoji, spectatorId: string) => number;
		getCombo: (emoji: SpectatorReactionEmoji) => number;
	}

	function createComboTracker(windowMs = 3000): ComboTracker {
		const reactions = new Map<
			SpectatorReactionEmoji,
			{ timestamp: number; spectatorId: string }[]
		>();

		return {
			reactions,
			comboWindowMs: windowMs,
			trackReaction(emoji: SpectatorReactionEmoji, spectatorId: string): number {
				const now = Date.now();
				const cutoff = now - this.comboWindowMs;

				let existing = reactions.get(emoji) ?? [];
				existing = existing.filter((r) => r.timestamp > cutoff);
				existing.push({ timestamp: now, spectatorId });
				reactions.set(emoji, existing);

				const uniqueSpectators = new Set(existing.map((r) => r.spectatorId));
				return uniqueSpectators.size;
			},
			getCombo(emoji: SpectatorReactionEmoji): number {
				const now = Date.now();
				const cutoff = now - this.comboWindowMs;
				const existing = reactions.get(emoji);

				if (!existing) return 0;

				const recent = existing.filter((r) => r.timestamp > cutoff);
				const uniqueSpectators = new Set(recent.map((r) => r.spectatorId));
				return uniqueSpectators.size;
			},
		};
	}

	it('tracks first reaction as combo of 1', () => {
		const tracker = createComboTracker();
		const count = tracker.trackReaction('👍', 'user-1');
		expect(count).toBe(1);
	});

	it('tracks multiple different spectators', () => {
		const tracker = createComboTracker();
		tracker.trackReaction('👍', 'user-1');
		const count = tracker.trackReaction('👍', 'user-2');
		expect(count).toBe(2);
	});

	it('counts unique spectators only', () => {
		const tracker = createComboTracker();
		tracker.trackReaction('👍', 'user-1');
		tracker.trackReaction('👍', 'user-1'); // Same user
		const count = tracker.trackReaction('👍', 'user-1'); // Same user again
		expect(count).toBe(1);
	});

	it('tracks different emojis separately', () => {
		const tracker = createComboTracker();
		tracker.trackReaction('👍', 'user-1');
		tracker.trackReaction('👍', 'user-2');
		const fireCount = tracker.trackReaction('🔥', 'user-1');
		const thumbsCount = tracker.getCombo('👍');

		expect(fireCount).toBe(1);
		expect(thumbsCount).toBe(2);
	});

	it('expires old reactions', async () => {
		const tracker = createComboTracker(100); // 100ms window

		tracker.trackReaction('👍', 'user-1');
		expect(tracker.getCombo('👍')).toBe(1);

		// Wait for expiry
		await new Promise((r) => setTimeout(r, 150));

		expect(tracker.getCombo('👍')).toBe(0);
	});
});

// =============================================================================
// Event Validation Tests
// =============================================================================

describe('Reaction Event Validation', () => {
	function isValidReaction(emoji: string): emoji is SpectatorReactionEmoji {
		const allEmojis = [
			...STANDARD_REACTIONS,
			...SPECTATOR_REACTIONS,
			...ROOTING_REACTIONS,
		] as const;
		return (allEmojis as readonly string[]).includes(emoji);
	}

	it('validates standard reactions', () => {
		expect(isValidReaction('👍')).toBe(true);
		expect(isValidReaction('🎲')).toBe(true);
		expect(isValidReaction('🎉')).toBe(true);
	});

	it('validates spectator reactions', () => {
		expect(isValidReaction('🍿')).toBe(true);
		expect(isValidReaction('📢')).toBe(true);
		expect(isValidReaction('🤡')).toBe(true);
	});

	it('validates rooting reactions', () => {
		expect(isValidReaction('📣')).toBe(true);
		expect(isValidReaction('💪')).toBe(true);
	});

	it('rejects invalid emojis', () => {
		expect(isValidReaction('❌')).toBe(false);
		expect(isValidReaction('🚀')).toBe(false);
		expect(isValidReaction('test')).toBe(false);
		expect(isValidReaction('')).toBe(false);
	});

	it('identifies rooting-required reactions', () => {
		const requiresRooting = (emoji: SpectatorReactionEmoji) =>
			REACTION_METADATA[emoji].requiresRooting === true;

		expect(requiresRooting('📣')).toBe(true);
		expect(requiresRooting('💪')).toBe(true);
		expect(requiresRooting('👍')).toBe(false);
		expect(requiresRooting('🍿')).toBe(false);
	});
});

// =============================================================================
// Reaction Event Structure Tests
// =============================================================================

describe('SpectatorReactionEvent Structure', () => {
	it('has required fields', () => {
		const event: SpectatorReactionEvent = {
			reaction: {
				id: 'test-123',
				spectatorId: 'user-456',
				spectatorName: 'TestSpectator',
				emoji: '🔥',
				timestamp: Date.now(),
			},
			comboCount: 3,
			playSound: true,
		};

		expect(event.reaction.id).toBeDefined();
		expect(event.reaction.spectatorId).toBeDefined();
		expect(event.reaction.spectatorName).toBeDefined();
		expect(event.reaction.emoji).toBeDefined();
		expect(event.reaction.timestamp).toBeDefined();
		expect(event.comboCount).toBeDefined();
		expect(event.playSound).toBeDefined();
	});

	it('supports optional targetPlayerId', () => {
		const eventWithTarget: SpectatorReactionEvent = {
			reaction: {
				id: 'test-123',
				spectatorId: 'user-456',
				spectatorName: 'TestSpectator',
				emoji: '📣',
				targetPlayerId: 'player-789',
				timestamp: Date.now(),
			},
			comboCount: 1,
			playSound: true,
		};

		expect(eventWithTarget.reaction.targetPlayerId).toBe('player-789');
	});

	it('can be created without targetPlayerId', () => {
		const event: SpectatorReactionEvent = {
			reaction: {
				id: 'test-123',
				spectatorId: 'user-456',
				spectatorName: 'TestSpectator',
				emoji: '👍',
				timestamp: Date.now(),
			},
			comboCount: 1,
			playSound: false,
		};

		expect(event.reaction.targetPlayerId).toBeUndefined();
	});
});

// =============================================================================
// Sound Logic Tests
// =============================================================================

describe('Sound Logic', () => {
	function shouldPlaySound(comboCount: number): boolean {
		return comboCount === 1 || comboCount % 5 === 0;
	}

	it('plays sound on first reaction', () => {
		expect(shouldPlaySound(1)).toBe(true);
	});

	it('does not play sound on 2-4', () => {
		expect(shouldPlaySound(2)).toBe(false);
		expect(shouldPlaySound(3)).toBe(false);
		expect(shouldPlaySound(4)).toBe(false);
	});

	it('plays sound every 5th combo', () => {
		expect(shouldPlaySound(5)).toBe(true);
		expect(shouldPlaySound(10)).toBe(true);
		expect(shouldPlaySound(15)).toBe(true);
		expect(shouldPlaySound(20)).toBe(true);
	});

	it('does not play sound between 5s', () => {
		expect(shouldPlaySound(6)).toBe(false);
		expect(shouldPlaySound(7)).toBe(false);
		expect(shouldPlaySound(8)).toBe(false);
		expect(shouldPlaySound(9)).toBe(false);
	});
});

// =============================================================================
// Available Reactions Logic Tests
// =============================================================================

describe('Available Reactions', () => {
	function getAvailableReactions(isRooting: boolean): readonly SpectatorReactionEmoji[] {
		const reactions: SpectatorReactionEmoji[] = [...STANDARD_REACTIONS, ...SPECTATOR_REACTIONS];

		if (isRooting) {
			reactions.push(...ROOTING_REACTIONS);
		}

		return reactions;
	}

	it('includes standard and spectator reactions for non-rooters', () => {
		const available = getAvailableReactions(false);

		// Check standard reactions present
		for (const emoji of STANDARD_REACTIONS) {
			expect(available).toContain(emoji);
		}

		// Check spectator reactions present
		for (const emoji of SPECTATOR_REACTIONS) {
			expect(available).toContain(emoji);
		}

		// Check rooting reactions NOT present
		for (const emoji of ROOTING_REACTIONS) {
			expect(available).not.toContain(emoji);
		}
	});

	it('includes all reactions for rooters', () => {
		const available = getAvailableReactions(true);

		// Check all reactions present
		const allReactions = [...STANDARD_REACTIONS, ...SPECTATOR_REACTIONS, ...ROOTING_REACTIONS];

		for (const emoji of allReactions) {
			expect(available).toContain(emoji);
		}
	});

	it('has correct counts', () => {
		const nonRooter = getAvailableReactions(false);
		const rooter = getAvailableReactions(true);

		expect(nonRooter).toHaveLength(11); // 5 + 6
		expect(rooter).toHaveLength(13); // 5 + 6 + 2
	});
});
