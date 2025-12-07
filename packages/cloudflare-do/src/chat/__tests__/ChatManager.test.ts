/**
 * ChatManager Unit Tests
 *
 * Comprehensive tests for the lobby chat system including:
 * - Message handling (text, quick chat, system)
 * - Rate limiting (messages, typing, reactions)
 * - Reaction management
 * - Typing indicators
 * - Message history
 * - State persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatManager } from '../ChatManager';
import { RATE_LIMITS, type ChatMessage, type RateLimitState } from '../types';

// =============================================================================
// Mock DurableObjectState
// =============================================================================

interface MockStorage {
	data: Map<string, unknown>;
	get: <T>(key: string) => Promise<T | undefined>;
	put: (key: string, value: unknown) => Promise<void>;
	delete: (key: string) => Promise<boolean>;
}

function createMockStorage(): MockStorage {
	const data = new Map<string, unknown>();

	return {
		data,
		get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
			return data.get(key) as T | undefined;
		}),
		put: vi.fn(async (key: string, value: unknown): Promise<void> => {
			data.set(key, value);
		}),
		delete: vi.fn(async (key: string): Promise<boolean> => {
			return data.delete(key);
		}),
	};
}

interface MockDurableObjectState {
	storage: MockStorage;
}

function createMockCtx(): MockDurableObjectState {
	return {
		storage: createMockStorage(),
	};
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ChatManager', () => {
	let chatManager: ChatManager;
	let mockCtx: MockDurableObjectState;

	beforeEach(() => {
		mockCtx = createMockCtx();
		chatManager = new ChatManager(mockCtx as unknown as DurableObjectState);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// =========================================================================
	// Initialization
	// =========================================================================

	describe('initialize', () => {
		it('should load messages from storage', async () => {
			const existingMessages: ChatMessage[] = [
				{
					id: 'msg1',
					type: 'text',
					userId: 'user1',
					displayName: 'Alice',
					content: 'Hello',
					timestamp: Date.now(),
					reactions: { '👍': [], '🎲': [], '😱': [], '💀': [], '🎉': [] },
				},
			];
			mockCtx.storage.data.set('chat:messages', existingMessages);

			await chatManager.initialize();

			const history = chatManager.getHistory();
			expect(history).toHaveLength(1);
			expect(history[0].content).toBe('Hello');
		});

		it('should load rate limits from storage', async () => {
			const existingRateLimits: Record<string, RateLimitState> = {
				user1: {
					lastMessageAt: Date.now() - 500,
					lastTypingAt: 0,
					reactionCount: 0,
					reactionWindowStart: 0,
				},
			};
			mockCtx.storage.data.set('chat:rateLimits', existingRateLimits);

			await chatManager.initialize();

			// User should still be rate limited (500ms ago, need 1000ms)
			const rateLimitError = chatManager.checkMessageRateLimit('user1');
			expect(rateLimitError).toBe('RATE_LIMITED');
		});

		it('should only initialize once', async () => {
			await chatManager.initialize();
			await chatManager.initialize(); // Second call

			expect(mockCtx.storage.get).toHaveBeenCalledTimes(2); // messages + rateLimits
		});

		it('should handle empty storage', async () => {
			await chatManager.initialize();

			const history = chatManager.getHistory();
			expect(history).toHaveLength(0);
		});
	});

	// =========================================================================
	// Text Messages
	// =========================================================================

	describe('handleTextMessage', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		it('should create a text message successfully', async () => {
			const result = await chatManager.handleTextMessage('user1', 'Alice', 'Hello world!');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.type).toBe('text');
				expect(result.message.userId).toBe('user1');
				expect(result.message.displayName).toBe('Alice');
				expect(result.message.content).toBe('Hello world!');
				expect(result.message.id).toBeDefined();
				expect(result.message.timestamp).toBeDefined();
			}
		});

		it('should trim message content', async () => {
			const result = await chatManager.handleTextMessage('user1', 'Alice', '  Hello  ');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.content).toBe('Hello');
			}
		});

		it('should add message to history', async () => {
			await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

			const history = chatManager.getHistory();
			expect(history).toHaveLength(1);
			expect(history[0].content).toBe('Hello');
		});

		it('should persist message to storage', async () => {
			await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

			expect(mockCtx.storage.put).toHaveBeenCalledWith(
				'chat:messages',
				expect.arrayContaining([expect.objectContaining({ content: 'Hello' })]),
			);
		});

		it('should reject messages that are too long', async () => {
			const longContent = 'a'.repeat(RATE_LIMITS.MAX_MESSAGE_LENGTH + 1);
			const result = await chatManager.handleTextMessage('user1', 'Alice', longContent);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('MESSAGE_TOO_LONG');
			}
		});

		it('should rate limit rapid messages', async () => {
			// First message succeeds
			const result1 = await chatManager.handleTextMessage('user1', 'Alice', 'First');
			expect(result1.success).toBe(true);

			// Immediate second message fails
			const result2 = await chatManager.handleTextMessage('user1', 'Alice', 'Second');
			expect(result2.success).toBe(false);
			if (!result2.success) {
				expect(result2.error).toBe('RATE_LIMITED');
			}
		});

		it('should allow messages after rate limit expires', async () => {
			await chatManager.handleTextMessage('user1', 'Alice', 'First');

			// Advance time past rate limit
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);

			const result = await chatManager.handleTextMessage('user1', 'Alice', 'Second');
			expect(result.success).toBe(true);
		});

		it('should clear typing indicator when sending message', async () => {
			chatManager.handleTypingStart('user1', 'Alice');
			expect(chatManager.getTypingUsers()).toHaveLength(1);

			await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

			expect(chatManager.getTypingUsers()).toHaveLength(0);
		});

		it('should initialize empty reactions', async () => {
			const result = await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.reactions).toEqual({
					'👍': [],
					'🎲': [],
					'😱': [],
					'💀': [],
					'🎉': [],
				});
			}
		});
	});

	// =========================================================================
	// Quick Chat
	// =========================================================================

	describe('handleQuickChat', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		it('should create a quick chat message', async () => {
			const result = await chatManager.handleQuickChat('user1', 'Alice', 'nice_roll');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.type).toBe('quick');
				expect(result.message.content).toBe('🎲 Nice roll!');
			}
		});

		it('should support all quick chat presets', async () => {
			const presets: Array<{ key: string; expected: string }> = [
				{ key: 'nice_roll', expected: '🎲 Nice roll!' },
				{ key: 'good_game', expected: '👏 Good game!' },
				{ key: 'your_turn', expected: '⏰ Your turn!' },
				{ key: 'yahtzee', expected: '🎉 YAHTZEE!' },
				{ key: 'ouch', expected: '💀 Ouch...' },
				{ key: 'thinking', expected: '🤔 Hmm, let me think...' },
			];

			for (const { key, expected } of presets) {
				// Reset time between messages
				vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);

				const result = await chatManager.handleQuickChat(
					'user1',
					'Alice',
					key as 'nice_roll' | 'good_game' | 'your_turn' | 'yahtzee' | 'ouch' | 'thinking',
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.message.content).toBe(expected);
				}
			}
		});

		it('should reject invalid quick chat keys', async () => {
			const result = await chatManager.handleQuickChat(
				'user1',
				'Alice',
				'invalid_key' as 'nice_roll',
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('INVALID_MESSAGE');
			}
		});

		it('should rate limit quick chat same as regular messages', async () => {
			await chatManager.handleQuickChat('user1', 'Alice', 'nice_roll');

			const result = await chatManager.handleQuickChat('user1', 'Alice', 'good_game');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('RATE_LIMITED');
			}
		});
	});

	// =========================================================================
	// System Messages
	// =========================================================================

	describe('createSystemMessage', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		it('should create a system message', async () => {
			const message = await chatManager.createSystemMessage('Alice joined the lobby');

			expect(message.type).toBe('system');
			expect(message.userId).toBe('system');
			expect(message.displayName).toBe('System');
			expect(message.content).toBe('Alice joined the lobby');
		});

		it('should add system message to history', async () => {
			await chatManager.createSystemMessage('Game started');

			const history = chatManager.getHistory();
			expect(history).toHaveLength(1);
			expect(history[0].type).toBe('system');
		});

		it('should not be rate limited', async () => {
			// System messages shouldn't be rate limited
			await chatManager.createSystemMessage('First');
			await chatManager.createSystemMessage('Second');
			await chatManager.createSystemMessage('Third');

			const history = chatManager.getHistory();
			expect(history).toHaveLength(3);
		});
	});

	// =========================================================================
	// Message History
	// =========================================================================

	describe('getHistory', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		it('should return a copy of messages', async () => {
			await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

			const history1 = chatManager.getHistory();
			const history2 = chatManager.getHistory();

			expect(history1).not.toBe(history2);
			expect(history1).toEqual(history2);
		});

		it('should trim history to max size', async () => {
			// Add more messages than history size
			for (let i = 0; i < RATE_LIMITS.MESSAGE_HISTORY_SIZE + 5; i++) {
				vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
				await chatManager.handleTextMessage('user1', 'Alice', `Message ${i}`);
			}

			const history = chatManager.getHistory();
			expect(history).toHaveLength(RATE_LIMITS.MESSAGE_HISTORY_SIZE);
			// Should have the most recent messages
			expect(history[0].content).toBe(`Message 5`);
		});

		it('should maintain chronological order', async () => {
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			await chatManager.handleTextMessage('user1', 'Alice', 'First');
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			await chatManager.handleTextMessage('user2', 'Bob', 'Second');
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			await chatManager.handleTextMessage('user1', 'Alice', 'Third');

			const history = chatManager.getHistory();
			expect(history[0].content).toBe('First');
			expect(history[1].content).toBe('Second');
			expect(history[2].content).toBe('Third');
		});
	});

	// =========================================================================
	// Reactions
	// =========================================================================

	describe('handleReaction', () => {
		let messageId: string;

		beforeEach(async () => {
			await chatManager.initialize();
			const result = await chatManager.handleTextMessage('user1', 'Alice', 'Hello');
			if (result.success) {
				messageId = result.message.id;
			}
		});

		it('should add a reaction', async () => {
			const result = await chatManager.handleReaction('user2', messageId, '👍', 'add');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.reactions['👍']).toContain('user2');
			}
		});

		it('should remove a reaction', async () => {
			await chatManager.handleReaction('user2', messageId, '👍', 'add');
			const result = await chatManager.handleReaction('user2', messageId, '👍', 'remove');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.reactions['👍']).not.toContain('user2');
			}
		});

		it('should not duplicate reactions', async () => {
			await chatManager.handleReaction('user2', messageId, '👍', 'add');
			vi.advanceTimersByTime(RATE_LIMITS.REACTION_WINDOW_MS + 1);
			await chatManager.handleReaction('user2', messageId, '👍', 'add');

			const history = chatManager.getHistory();
			const message = history.find((m) => m.id === messageId);
			expect(message?.reactions['👍'].filter((u) => u === 'user2')).toHaveLength(1);
		});

		it('should allow multiple users to react', async () => {
			await chatManager.handleReaction('user2', messageId, '👍', 'add');
			await chatManager.handleReaction('user3', messageId, '👍', 'add');

			const result = await chatManager.handleReaction('user4', messageId, '👍', 'add');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.reactions['👍']).toContain('user2');
				expect(result.reactions['👍']).toContain('user3');
				expect(result.reactions['👍']).toContain('user4');
			}
		});

		it('should support all reaction emojis', async () => {
			const emojis = ['👍', '🎲', '😱', '💀', '🎉'] as const;

			for (const emoji of emojis) {
				vi.advanceTimersByTime(RATE_LIMITS.REACTION_WINDOW_MS + 1);
				const result = await chatManager.handleReaction('user2', messageId, emoji, 'add');

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.reactions[emoji]).toContain('user2');
				}
			}
		});

		it('should reject invalid emoji', async () => {
			const result = await chatManager.handleReaction(
				'user2',
				messageId,
				'❌' as '👍',
				'add',
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('INVALID_MESSAGE');
			}
		});

		it('should reject reaction on non-existent message', async () => {
			const result = await chatManager.handleReaction('user2', 'fake-id', '👍', 'add');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('MESSAGE_NOT_FOUND');
			}
		});

		it('should rate limit rapid reactions', async () => {
			// Add max reactions quickly
			for (let i = 0; i < RATE_LIMITS.REACTIONS_PER_WINDOW; i++) {
				vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
				const msg = await chatManager.handleTextMessage('user1', 'Alice', `Msg ${i}`);
				if (msg.success) {
					await chatManager.handleReaction('user2', msg.message.id, '👍', 'add');
				}
			}

			// Next reaction should be rate limited
			const msg = await chatManager.handleTextMessage('user1', 'Alice', 'Last');
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			if (msg.success) {
				const result = await chatManager.handleReaction('user2', msg.message.id, '👍', 'add');
				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error).toBe('RATE_LIMITED');
				}
			}
		});

		it('should not rate limit reaction removal', async () => {
			// Add and exhaust rate limit
			for (let i = 0; i < RATE_LIMITS.REACTIONS_PER_WINDOW; i++) {
				vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
				const msg = await chatManager.handleTextMessage('user1', 'Alice', `Msg ${i}`);
				if (msg.success) {
					await chatManager.handleReaction('user2', msg.message.id, '👍', 'add');
				}
			}

			// Remove should still work
			const result = await chatManager.handleReaction('user2', messageId, '👍', 'remove');
			expect(result.success).toBe(true);
		});
	});

	// =========================================================================
	// Typing Indicators
	// =========================================================================

	describe('typing indicators', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		describe('handleTypingStart', () => {
			it('should add typing indicator', () => {
				const result = chatManager.handleTypingStart('user1', 'Alice');

				expect(result).toBe(true);
				const typing = chatManager.getTypingUsers();
				expect(typing).toHaveLength(1);
				expect(typing[0].userId).toBe('user1');
				expect(typing[0].displayName).toBe('Alice');
			});

			it('should update existing typing indicator', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_INTERVAL_MS + 1);
				chatManager.handleTypingStart('user1', 'Alice Updated');

				const typing = chatManager.getTypingUsers();
				expect(typing).toHaveLength(1);
				expect(typing[0].displayName).toBe('Alice Updated');
			});

			it('should rate limit typing indicators', () => {
				chatManager.handleTypingStart('user1', 'Alice');

				// Immediate second call should be rate limited
				const result = chatManager.handleTypingStart('user1', 'Alice');
				expect(result).toBe(false);
			});

			it('should allow typing after rate limit expires', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_INTERVAL_MS + 1);

				const result = chatManager.handleTypingStart('user1', 'Alice');
				expect(result).toBe(true);
			});

			it('should support multiple users typing', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				chatManager.handleTypingStart('user2', 'Bob');
				chatManager.handleTypingStart('user3', 'Charlie');

				const typing = chatManager.getTypingUsers();
				expect(typing).toHaveLength(3);
			});
		});

		describe('handleTypingStop', () => {
			it('should remove typing indicator', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				const result = chatManager.handleTypingStop('user1');

				expect(result).toBe(true);
				expect(chatManager.getTypingUsers()).toHaveLength(0);
			});

			it('should return false if user was not typing', () => {
				const result = chatManager.handleTypingStop('user1');
				expect(result).toBe(false);
			});
		});

		describe('getTypingUsers', () => {
			it('should filter out expired typing indicators', () => {
				chatManager.handleTypingStart('user1', 'Alice');

				// Advance past timeout
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_TIMEOUT_MS + 1);

				const typing = chatManager.getTypingUsers();
				expect(typing).toHaveLength(0);
			});

			it('should keep active typing indicators', () => {
				chatManager.handleTypingStart('user1', 'Alice');

				// Advance but not past timeout
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_TIMEOUT_MS - 100);

				const typing = chatManager.getTypingUsers();
				expect(typing).toHaveLength(1);
			});

			it('should clean up expired indicators', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_TIMEOUT_MS + 1);

				// First call filters and cleans up
				chatManager.getTypingUsers();

				// Second call should also return empty (not re-add)
				expect(chatManager.getTypingUsers()).toHaveLength(0);
			});
		});

		describe('clearTyping', () => {
			it('should clear typing indicator', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				const result = chatManager.clearTyping('user1');

				expect(result).toBe(true);
				expect(chatManager.getTypingUsers()).toHaveLength(0);
			});

			it('should return false if user was not typing', () => {
				const result = chatManager.clearTyping('user1');
				expect(result).toBe(false);
			});
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('rate limiting', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		describe('checkMessageRateLimit', () => {
			it('should return null for new user', () => {
				const result = chatManager.checkMessageRateLimit('newuser');
				expect(result).toBeNull();
			});

			it('should return RATE_LIMITED within interval', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

				const result = chatManager.checkMessageRateLimit('user1');
				expect(result).toBe('RATE_LIMITED');
			});

			it('should return null after interval expires', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');
				vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);

				const result = chatManager.checkMessageRateLimit('user1');
				expect(result).toBeNull();
			});
		});

		describe('checkTypingRateLimit', () => {
			it('should return true for new user', () => {
				const result = chatManager.checkTypingRateLimit('newuser');
				expect(result).toBe(true);
			});

			it('should return false within interval', () => {
				chatManager.handleTypingStart('user1', 'Alice');

				const result = chatManager.checkTypingRateLimit('user1');
				expect(result).toBe(false);
			});

			it('should return true after interval expires', () => {
				chatManager.handleTypingStart('user1', 'Alice');
				vi.advanceTimersByTime(RATE_LIMITS.TYPING_INTERVAL_MS + 1);

				const result = chatManager.checkTypingRateLimit('user1');
				expect(result).toBe(true);
			});
		});

		describe('checkReactionRateLimit', () => {
			it('should return null for new user', () => {
				const result = chatManager.checkReactionRateLimit('newuser');
				expect(result).toBeNull();
			});

			it('should reset window after expiry', async () => {
				// First, create enough messages to react to
				const messageIds: string[] = [];
				for (let i = 0; i < RATE_LIMITS.REACTIONS_PER_WINDOW + 1; i++) {
					vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
					const msg = await chatManager.handleTextMessage('user1', 'Alice', `Msg ${i}`);
					if (msg.success) {
						messageIds.push(msg.message.id);
					}
				}

				// Now add reactions quickly (within the same window)
				for (let i = 0; i < RATE_LIMITS.REACTIONS_PER_WINDOW; i++) {
					await chatManager.handleReaction('user2', messageIds[i], '👍', 'add');
				}

				// Should be rate limited
				expect(chatManager.checkReactionRateLimit('user2')).toBe('RATE_LIMITED');

				// Advance past window
				vi.advanceTimersByTime(RATE_LIMITS.REACTION_WINDOW_MS + 1);

				// Should be allowed again
				expect(chatManager.checkReactionRateLimit('user2')).toBeNull();
			});
		});
	});

	// =========================================================================
	// Cleanup
	// =========================================================================

	describe('cleanup', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		describe('removeUser', () => {
			it('should remove user rate limits', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

				await chatManager.removeUser('user1');

				// User should no longer be rate limited
				const result = chatManager.checkMessageRateLimit('user1');
				expect(result).toBeNull();
			});

			it('should remove user typing indicator', async () => {
				chatManager.handleTypingStart('user1', 'Alice');

				await chatManager.removeUser('user1');

				expect(chatManager.getTypingUsers()).toHaveLength(0);
			});

			it('should persist rate limit changes', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');
				await chatManager.removeUser('user1');

				expect(mockCtx.storage.put).toHaveBeenCalledWith(
					'chat:rateLimits',
					expect.not.objectContaining({ user1: expect.anything() }),
				);
			});
		});

		describe('clearAll', () => {
			it('should clear all messages', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');
				await chatManager.createSystemMessage('System');

				await chatManager.clearAll();

				expect(chatManager.getHistory()).toHaveLength(0);
			});

			it('should clear all rate limits', async () => {
				await chatManager.handleTextMessage('user1', 'Alice', 'Hello');

				await chatManager.clearAll();

				expect(chatManager.checkMessageRateLimit('user1')).toBeNull();
			});

			it('should clear all typing indicators', async () => {
				chatManager.handleTypingStart('user1', 'Alice');
				chatManager.handleTypingStart('user2', 'Bob');

				await chatManager.clearAll();

				expect(chatManager.getTypingUsers()).toHaveLength(0);
			});

			it('should delete from storage', async () => {
				await chatManager.clearAll();

				expect(mockCtx.storage.delete).toHaveBeenCalledWith('chat:messages');
				expect(mockCtx.storage.delete).toHaveBeenCalledWith('chat:rateLimits');
			});
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('edge cases', () => {
		beforeEach(async () => {
			await chatManager.initialize();
		});

		it('should handle concurrent messages from different users', async () => {
			const results = await Promise.all([
				chatManager.handleTextMessage('user1', 'Alice', 'Hello from Alice'),
				chatManager.handleTextMessage('user2', 'Bob', 'Hello from Bob'),
				chatManager.handleTextMessage('user3', 'Charlie', 'Hello from Charlie'),
			]);

			expect(results.every((r) => r.success)).toBe(true);
			expect(chatManager.getHistory()).toHaveLength(3);
		});

		it('should handle empty content after trim', async () => {
			const result = await chatManager.handleTextMessage('user1', 'Alice', '   ');

			// Empty string after trim should still have length 0 but trim happens in schema
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.content).toBe('');
			}
		});

		it('should handle special characters in content', async () => {
			const content = '👋 Hello <script>alert("xss")</script> & "quotes" \'apostrophe\'';
			const result = await chatManager.handleTextMessage('user1', 'Alice', content);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.content).toBe(content);
			}
		});

		it('should handle unicode in display names', async () => {
			const result = await chatManager.handleTextMessage('user1', '日本語名前', 'Hello');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.message.displayName).toBe('日本語名前');
			}
		});

		it('should generate unique message IDs', async () => {
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			const result1 = await chatManager.handleTextMessage('user1', 'Alice', 'First');
			vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);
			const result2 = await chatManager.handleTextMessage('user1', 'Alice', 'Second');

			if (result1.success && result2.success) {
				expect(result1.message.id).not.toBe(result2.message.id);
			}
		});
	});
});
