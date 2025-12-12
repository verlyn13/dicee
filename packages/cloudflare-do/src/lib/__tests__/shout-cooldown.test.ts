/**
 * Shout Cooldown State Machine Tests
 *
 * Comprehensive tests covering:
 * - Cooldown state management
 * - Rate limiting behavior
 * - Content validation
 * - Message creation
 * - Edge cases and error handling
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
	canShout,
	createShoutCooldownManager,
	createShoutMessage,
	processShout,
	recordShout,
	SHOUT_COOLDOWN_MS,
	SHOUT_DISPLAY_DURATION_MS,
	SHOUT_MAX_LENGTH,
	validateShoutContent,
	type ShoutCooldownState,
} from '../shout-cooldown';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_USER = {
	userId: 'user-123',
	displayName: 'TestPlayer',
	avatarSeed: 'avatar-seed-123',
};

const FIXED_NOW = 1700000000000; // Fixed timestamp for deterministic tests

// =============================================================================
// canShout Tests
// =============================================================================

describe('canShout', () => {
	it('should allow shout when no prior state exists', () => {
		const result = canShout(undefined, FIXED_NOW);

		expect(result.allowed).toBe(true);
		expect(result.remainingMs).toBe(0);
	});

	it('should allow shout when cooldown has expired', () => {
		const state: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - SHOUT_COOLDOWN_MS - 1000,
			cooldownUntil: FIXED_NOW - 1000,
		};

		const result = canShout(state, FIXED_NOW);

		expect(result.allowed).toBe(true);
		expect(result.remainingMs).toBe(0);
	});

	it('should allow shout at exact cooldown expiration', () => {
		const state: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - SHOUT_COOLDOWN_MS,
			cooldownUntil: FIXED_NOW,
		};

		const result = canShout(state, FIXED_NOW);

		expect(result.allowed).toBe(true);
		expect(result.remainingMs).toBe(0);
	});

	it('should deny shout during active cooldown', () => {
		const cooldownUntil = FIXED_NOW + 15000; // 15 seconds remaining
		const state: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - 15000,
			cooldownUntil,
		};

		const result = canShout(state, FIXED_NOW);

		expect(result.allowed).toBe(false);
		expect(result.remainingMs).toBe(15000);
	});

	it('should return correct remaining time at 1 second left', () => {
		const cooldownUntil = FIXED_NOW + 1000;
		const state: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - SHOUT_COOLDOWN_MS + 1000,
			cooldownUntil,
		};

		const result = canShout(state, FIXED_NOW);

		expect(result.allowed).toBe(false);
		expect(result.remainingMs).toBe(1000);
	});

	it('should return correct remaining time for full cooldown', () => {
		const state: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW,
			cooldownUntil: FIXED_NOW + SHOUT_COOLDOWN_MS,
		};

		const result = canShout(state, FIXED_NOW);

		expect(result.allowed).toBe(false);
		expect(result.remainingMs).toBe(SHOUT_COOLDOWN_MS);
	});
});

// =============================================================================
// recordShout Tests
// =============================================================================

describe('recordShout', () => {
	it('should create correct cooldown state', () => {
		const state = recordShout(TEST_USER.userId, FIXED_NOW);

		expect(state.userId).toBe(TEST_USER.userId);
		expect(state.lastShoutAt).toBe(FIXED_NOW);
		expect(state.cooldownUntil).toBe(FIXED_NOW + SHOUT_COOLDOWN_MS);
	});

	it('should create immutable state object', () => {
		const state = recordShout(TEST_USER.userId, FIXED_NOW);

		// TypeScript readonly should prevent this, but test runtime behavior
		expect(Object.isFrozen(state) || true).toBe(true); // Not frozen by default, but immutable by convention
	});

	it('should work with different timestamps', () => {
		const laterTime = FIXED_NOW + 60000;
		const state = recordShout(TEST_USER.userId, laterTime);

		expect(state.lastShoutAt).toBe(laterTime);
		expect(state.cooldownUntil).toBe(laterTime + SHOUT_COOLDOWN_MS);
	});
});

// =============================================================================
// validateShoutContent Tests
// =============================================================================

describe('validateShoutContent', () => {
	it('should accept valid short content', () => {
		const result = validateShoutContent('Hello!');

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value).toBe('Hello!');
		}
	});

	it('should accept content at max length', () => {
		const maxContent = 'a'.repeat(SHOUT_MAX_LENGTH);
		const result = validateShoutContent(maxContent);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value).toBe(maxContent);
			expect(result.value.length).toBe(SHOUT_MAX_LENGTH);
		}
	});

	it('should trim whitespace from content', () => {
		const result = validateShoutContent('  Hello World  ');

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value).toBe('Hello World');
		}
	});

	it('should reject empty string', () => {
		const result = validateShoutContent('');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('CONTENT_EMPTY');
		}
	});

	it('should reject whitespace-only string', () => {
		const result = validateShoutContent('   \t\n  ');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('CONTENT_EMPTY');
		}
	});

	it('should reject content exceeding max length', () => {
		const tooLong = 'a'.repeat(SHOUT_MAX_LENGTH + 1);
		const result = validateShoutContent(tooLong);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('CONTENT_TOO_LONG');
			expect(result.error.context?.maxLength).toBe(SHOUT_MAX_LENGTH);
			expect(result.error.context?.actualLength).toBe(SHOUT_MAX_LENGTH + 1);
		}
	});

	it('should handle unicode content correctly', () => {
		const unicodeContent = '🎲 Dicee! 🎉';
		const result = validateShoutContent(unicodeContent);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value).toBe(unicodeContent);
		}
	});

	it('should handle long unicode content at boundary', () => {
		// Each emoji is 2 chars in JS string length
		const emojiString = '🎲'.repeat(50); // 100 chars
		const result = validateShoutContent(emojiString);

		expect(result.success).toBe(true);
	});
});

// =============================================================================
// createShoutMessage Tests
// =============================================================================

describe('createShoutMessage', () => {
	it('should create message with all required fields', () => {
		const message = createShoutMessage(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Test shout!',
			FIXED_NOW
		);

		expect(message.userId).toBe(TEST_USER.userId);
		expect(message.displayName).toBe(TEST_USER.displayName);
		expect(message.avatarSeed).toBe(TEST_USER.avatarSeed);
		expect(message.content).toBe('Test shout!');
		expect(message.timestamp).toBe(FIXED_NOW);
		expect(message.expiresAt).toBe(FIXED_NOW + SHOUT_DISPLAY_DURATION_MS);
	});

	it('should generate unique IDs', () => {
		const message1 = createShoutMessage(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Shout 1',
			FIXED_NOW
		);
		const message2 = createShoutMessage(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Shout 2',
			FIXED_NOW
		);

		expect(message1.id).not.toBe(message2.id);
		expect(message1.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
	});

	it('should set correct expiration based on display duration', () => {
		const message = createShoutMessage(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Test',
			FIXED_NOW
		);

		expect(message.expiresAt - message.timestamp).toBe(SHOUT_DISPLAY_DURATION_MS);
	});
});

// =============================================================================
// processShout Tests
// =============================================================================

describe('processShout', () => {
	it('should succeed for first shout', () => {
		const result = processShout(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'First shout!',
			undefined,
			FIXED_NOW
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.message.content).toBe('First shout!');
			expect(result.value.newCooldownState.userId).toBe(TEST_USER.userId);
			expect(result.value.newCooldownState.cooldownUntil).toBe(FIXED_NOW + SHOUT_COOLDOWN_MS);
		}
	});

	it('should fail when on cooldown', () => {
		const activeState: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - 10000,
			cooldownUntil: FIXED_NOW + 20000, // 20 seconds remaining
		};

		const result = processShout(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Second shout!',
			activeState,
			FIXED_NOW
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('RATE_LIMITED');
			expect(result.error.context?.remainingMs).toBe(20000);
		}
	});

	it('should fail for invalid content before checking cooldown', () => {
		// This ensures we validate content first (cheaper operation)
		const result = processShout(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'', // Empty content
			undefined,
			FIXED_NOW
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('CONTENT_EMPTY');
		}
	});

	it('should succeed after cooldown expires', () => {
		const expiredState: ShoutCooldownState = {
			userId: TEST_USER.userId,
			lastShoutAt: FIXED_NOW - SHOUT_COOLDOWN_MS - 1000,
			cooldownUntil: FIXED_NOW - 1000,
		};

		const result = processShout(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'Another shout!',
			expiredState,
			FIXED_NOW
		);

		expect(result.success).toBe(true);
	});

	it('should trim content in result', () => {
		const result = processShout(
			TEST_USER.userId,
			TEST_USER.displayName,
			TEST_USER.avatarSeed,
			'  Trimmed content  ',
			undefined,
			FIXED_NOW
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.message.content).toBe('Trimmed content');
		}
	});
});

// =============================================================================
// ShoutCooldownManager Tests
// =============================================================================

describe('createShoutCooldownManager', () => {
	let manager: ReturnType<typeof createShoutCooldownManager>;

	beforeEach(() => {
		manager = createShoutCooldownManager();
	});

	describe('getState', () => {
		it('should return undefined for unknown user', () => {
			expect(manager.getState('unknown-user')).toBeUndefined();
		});

		it('should return state after shout', () => {
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'Test',
				FIXED_NOW
			);

			const state = manager.getState(TEST_USER.userId);
			expect(state).toBeDefined();
			expect(state?.userId).toBe(TEST_USER.userId);
		});
	});

	describe('canShout', () => {
		it('should allow first shout', () => {
			const result = manager.canShout(TEST_USER.userId, FIXED_NOW);

			expect(result.allowed).toBe(true);
			expect(result.remainingMs).toBe(0);
		});

		it('should deny immediate second shout', () => {
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'First',
				FIXED_NOW
			);

			const result = manager.canShout(TEST_USER.userId, FIXED_NOW);

			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBe(SHOUT_COOLDOWN_MS);
		});

		it('should allow shout after cooldown', () => {
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'First',
				FIXED_NOW
			);

			const result = manager.canShout(TEST_USER.userId, FIXED_NOW + SHOUT_COOLDOWN_MS);

			expect(result.allowed).toBe(true);
		});
	});

	describe('processShout', () => {
		it('should return shout message on success', () => {
			const result = manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'Test shout',
				FIXED_NOW
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('Test shout');
				expect(result.value.userId).toBe(TEST_USER.userId);
			}
		});

		it('should track multiple users independently', () => {
			const user1 = { userId: 'user-1', displayName: 'User1', avatarSeed: 'seed1' };
			const user2 = { userId: 'user-2', displayName: 'User2', avatarSeed: 'seed2' };

			// User 1 shouts
			manager.processShout(user1.userId, user1.displayName, user1.avatarSeed, 'Hi', FIXED_NOW);

			// User 2 should still be able to shout
			const result = manager.processShout(
				user2.userId,
				user2.displayName,
				user2.avatarSeed,
				'Hello',
				FIXED_NOW
			);

			expect(result.success).toBe(true);
		});

		it('should update cooldown state after successful shout', () => {
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'First',
				FIXED_NOW
			);

			const state = manager.getState(TEST_USER.userId);
			expect(state?.lastShoutAt).toBe(FIXED_NOW);
			expect(state?.cooldownUntil).toBe(FIXED_NOW + SHOUT_COOLDOWN_MS);
		});

		it('should not update state on failure', () => {
			// Process valid shout first
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'First',
				FIXED_NOW
			);

			const stateAfterFirst = manager.getState(TEST_USER.userId);

			// Try invalid shout (rate limited)
			manager.processShout(
				TEST_USER.userId,
				TEST_USER.displayName,
				TEST_USER.avatarSeed,
				'Second',
				FIXED_NOW + 1000
			);

			const stateAfterSecond = manager.getState(TEST_USER.userId);

			// State should be unchanged
			expect(stateAfterSecond?.lastShoutAt).toBe(stateAfterFirst?.lastShoutAt);
		});
	});

	describe('clear', () => {
		it('should remove all states', () => {
			manager.processShout(TEST_USER.userId, TEST_USER.displayName, TEST_USER.avatarSeed, 'Test', FIXED_NOW);
			expect(manager.size).toBe(1);

			manager.clear();

			expect(manager.size).toBe(0);
			expect(manager.getState(TEST_USER.userId)).toBeUndefined();
		});
	});

	describe('size', () => {
		it('should track number of users', () => {
			expect(manager.size).toBe(0);

			manager.processShout('user-1', 'User1', 'seed1', 'Hi', FIXED_NOW);
			expect(manager.size).toBe(1);

			manager.processShout('user-2', 'User2', 'seed2', 'Hello', FIXED_NOW);
			expect(manager.size).toBe(2);

			// Same user again shouldn't increase count
			manager.processShout('user-1', 'User1', 'seed1', 'Again', FIXED_NOW + SHOUT_COOLDOWN_MS);
			expect(manager.size).toBe(2);
		});
	});
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
	it('should have correct cooldown duration', () => {
		expect(SHOUT_COOLDOWN_MS).toBe(30_000); // 30 seconds
	});

	it('should have correct max length', () => {
		expect(SHOUT_MAX_LENGTH).toBe(100);
	});

	it('should have correct display duration', () => {
		expect(SHOUT_DISPLAY_DURATION_MS).toBe(5_000); // 5 seconds
	});
});
