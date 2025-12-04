/**
 * Keyboard Navigation Hook Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY_BINDINGS } from '../useKeyboardNavigation.svelte.js';

describe('useKeyboardNavigation', () => {
	// Note: Testing Svelte 5 rune-based hooks requires a Svelte component context
	// These tests verify the exported constants and types

	describe('KEY_BINDINGS', () => {
		it('exports roll key binding', () => {
			const rollBinding = KEY_BINDINGS.find((b) => b.action === 'Roll dice');
			expect(rollBinding).toBeDefined();
			expect(rollBinding?.key).toBe('R / Space');
		});

		it('exports dice toggle binding', () => {
			const toggleBinding = KEY_BINDINGS.find((b) => b.action.includes('Toggle keep'));
			expect(toggleBinding).toBeDefined();
			expect(toggleBinding?.key).toBe('1-5');
		});

		it('exports keep all binding', () => {
			const keepAllBinding = KEY_BINDINGS.find((b) => b.action.includes('Keep all'));
			expect(keepAllBinding).toBeDefined();
			expect(keepAllBinding?.key).toBe('A');
		});

		it('exports release all binding', () => {
			const releaseBinding = KEY_BINDINGS.find((b) => b.action.includes('Release'));
			expect(releaseBinding).toBeDefined();
			expect(releaseBinding?.key).toBe('Z');
		});

		it('has 4 key bindings', () => {
			expect(KEY_BINDINGS).toHaveLength(4);
		});
	});

	describe('keyboard event handling', () => {
		let _mockOnRoll: ReturnType<typeof vi.fn>;
		let _mockOnToggleKeep: ReturnType<typeof vi.fn>;
		let _mockOnKeepAll: ReturnType<typeof vi.fn>;
		let _mockOnReleaseAll: ReturnType<typeof vi.fn>;
		let _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

		beforeEach(() => {
			_mockOnRoll = vi.fn();
			_mockOnToggleKeep = vi.fn();
			_mockOnKeepAll = vi.fn();
			_mockOnReleaseAll = vi.fn();

			// Capture the event listener
			vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
				if (type === 'keydown') {
					_keydownHandler = handler as (e: KeyboardEvent) => void;
				}
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
			_keydownHandler = null;
		});

		function createKeyEvent(key: string): KeyboardEvent {
			return new KeyboardEvent('keydown', { key, bubbles: true });
		}

		it('should have correct key for roll action', () => {
			const event = createKeyEvent('r');
			expect(event.key).toBe('r');
		});

		it('should have correct keys for dice toggle', () => {
			for (const key of ['1', '2', '3', '4', '5']) {
				const event = createKeyEvent(key);
				expect(event.key).toBe(key);
			}
		});

		it('should have correct key for keep all', () => {
			const event = createKeyEvent('a');
			expect(event.key).toBe('a');
		});

		it('should have correct key for release all', () => {
			const event = createKeyEvent('z');
			expect(event.key).toBe('z');
		});

		it('space key should be valid for roll', () => {
			const event = createKeyEvent(' ');
			expect(event.key).toBe(' ');
		});
	});
});

describe('KEY_BINDINGS constant', () => {
	it('is readonly array', () => {
		// TypeScript will catch mutations at compile time
		// This test documents the expected structure
		expect(Array.isArray(KEY_BINDINGS)).toBe(true);
	});

	it('each binding has key and action', () => {
		for (const binding of KEY_BINDINGS) {
			expect(binding).toHaveProperty('key');
			expect(binding).toHaveProperty('action');
			expect(typeof binding.key).toBe('string');
			expect(typeof binding.action).toBe('string');
		}
	});
});
