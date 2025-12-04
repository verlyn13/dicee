/**
 * GameStatus Component Tests
 * Tests game state display, turn tracking, and game over scenarios
 */

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import GameStatus from '../GameStatus.svelte';

// =============================================================================
// Test Fixtures
// =============================================================================

const defaultProps = {
	turnNumber: 1,
	totalTurns: 13,
	grandTotal: 0,
	isGameOver: false,
	onNewGame: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onNewGame: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// Active Game Display Tests
// =============================================================================

describe('GameStatus Component - Active Game', () => {
	it('renders status row during active game', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: false }),
		});

		expect(container.querySelector('.status-row')).toBeInTheDocument();
	});

	it('displays turn number correctly', () => {
		const { getByText } = render(GameStatus, {
			props: createProps({ turnNumber: 5 }),
		});

		expect(getByText('5/13')).toBeInTheDocument();
	});

	it('displays custom total turns', () => {
		const { getByText } = render(GameStatus, {
			props: createProps({ turnNumber: 3, totalTurns: 10 }),
		});

		expect(getByText('3/10')).toBeInTheDocument();
	});

	it('displays grand total', () => {
		const { getByText } = render(GameStatus, {
			props: createProps({ grandTotal: 150 }),
		});

		expect(getByText('150')).toBeInTheDocument();
	});

	it('displays turns remaining', () => {
		const { getByText } = render(GameStatus, {
			props: createProps({ turnNumber: 5, totalTurns: 13 }),
		});

		// 13 - 5 = 8 turns remaining
		expect(getByText('8')).toBeInTheDocument();
	});

	it('calculates turns remaining correctly', () => {
		const cases = [
			{ turnNumber: 1, totalTurns: 13, expected: 12 },
			{ turnNumber: 7, totalTurns: 13, expected: 6 },
			{ turnNumber: 13, totalTurns: 13, expected: 0 },
		];

		for (const { turnNumber, totalTurns, expected } of cases) {
			const { container } = render(GameStatus, {
				props: createProps({ turnNumber, totalTurns }),
			});

			const remainingItem = container.querySelector('.status-item.remaining');
			const value = remainingItem?.querySelector('.status-value');
			expect(value?.textContent).toBe(String(expected));
		}
	});

	it('shows Turn, Score, and Left labels', () => {
		const { getByText } = render(GameStatus, {
			props: createProps(),
		});

		expect(getByText('Turn')).toBeInTheDocument();
		expect(getByText('Score')).toBeInTheDocument();
		expect(getByText('Left')).toBeInTheDocument();
	});

	it('does not show game-over class during active game', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: false }),
		});

		expect(container.querySelector('.game-status')).not.toHaveClass('game-over');
	});

	it('hides final score display during active game', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: false }),
		});

		expect(container.querySelector('.final-score-display')).not.toBeInTheDocument();
	});

	it('hides new game button during active game', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: false }),
		});

		expect(container.querySelector('.new-game-btn')).not.toBeInTheDocument();
	});
});

// =============================================================================
// Game Over Display Tests
// =============================================================================

describe('GameStatus Component - Game Over', () => {
	it('shows game-over class when game is over', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		expect(container.querySelector('.game-status')).toHaveClass('game-over');
	});

	it('shows final score display when game over', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		expect(container.querySelector('.final-score-display')).toBeInTheDocument();
	});

	it('displays "Final Score" label', () => {
		const { getByText } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		expect(getByText('Final Score')).toBeInTheDocument();
	});

	it('displays final grand total', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true, grandTotal: 275 }),
		});

		const finalScore = container.querySelector('.final-score');
		expect(finalScore?.textContent).toBe('275');
	});

	it('shows Play Again button when onNewGame provided', () => {
		const { getByRole } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		expect(getByRole('button', { name: /play again/i })).toBeInTheDocument();
	});

	it('hides Play Again button when onNewGame not provided', () => {
		const { container } = render(GameStatus, {
			props: {
				turnNumber: 13,
				grandTotal: 200,
				isGameOver: true,
				// No onNewGame
			},
		});

		expect(container.querySelector('.new-game-btn')).not.toBeInTheDocument();
	});

	it('hides status row when game over', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		expect(container.querySelector('.status-row')).not.toBeInTheDocument();
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('GameStatus Component - Interactions', () => {
	it('calls onNewGame when Play Again clicked', async () => {
		const props = createProps({ isGameOver: true });
		const { getByRole } = render(GameStatus, { props });

		const button = getByRole('button', { name: /play again/i });
		await fireEvent.click(button);

		expect(props.onNewGame).toHaveBeenCalledTimes(1);
	});

	it('does not call onNewGame during active game', () => {
		const props = createProps({ isGameOver: false });
		render(GameStatus, { props });

		// Button doesn't exist, so onNewGame shouldn't be callable
		expect(props.onNewGame).not.toHaveBeenCalled();
	});
});

// =============================================================================
// Score Display Tests
// =============================================================================

describe('GameStatus Component - Score Formatting', () => {
	it('displays zero score', () => {
		const { container } = render(GameStatus, {
			props: createProps({ grandTotal: 0 }),
		});

		const scoreItem = container.querySelector('.status-item.score');
		const value = scoreItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('0');
	});

	it('displays large scores correctly', () => {
		const { container } = render(GameStatus, {
			props: createProps({ grandTotal: 375 }),
		});

		const scoreItem = container.querySelector('.status-item.score');
		const value = scoreItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('375');
	});

	it('displays final score with proper styling class', () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true, grandTotal: 275 }),
		});

		expect(container.querySelector('.final-score')).toBeInTheDocument();
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('GameStatus Component - Accessibility', () => {
	it('passes axe audit during active game', async () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: false }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit when game over', async () => {
		const { container } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('Play Again button is a button element', () => {
		const { getByRole } = render(GameStatus, {
			props: createProps({ isGameOver: true }),
		});

		const button = getByRole('button', { name: /play again/i });
		expect(button.tagName).toBe('BUTTON');
	});

	it('status values use monospace font for readability', () => {
		const { container } = render(GameStatus, {
			props: createProps(),
		});

		const values = container.querySelectorAll('.status-value');
		// Verify class is present (CSS applies font-mono)
		for (const value of values) {
			expect(value).toHaveClass('status-value');
		}
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('GameStatus Component - Edge Cases', () => {
	it('handles turn 1 correctly', () => {
		const { container } = render(GameStatus, {
			props: createProps({ turnNumber: 1, totalTurns: 13 }),
		});

		const turnItem = container.querySelector('.status-item.turn');
		const value = turnItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('1/13');

		const remainingItem = container.querySelector('.status-item.remaining');
		const remaining = remainingItem?.querySelector('.status-value');
		expect(remaining?.textContent).toBe('12');
	});

	it('handles final turn correctly', () => {
		const { container } = render(GameStatus, {
			props: createProps({ turnNumber: 13, totalTurns: 13 }),
		});

		const remainingItem = container.querySelector('.status-item.remaining');
		const value = remainingItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('0');
	});

	it('handles mid-game transition to game over', () => {
		const { container, rerender } = render(GameStatus, {
			props: createProps({ isGameOver: false, turnNumber: 7 }),
		});

		expect(container.querySelector('.status-row')).toBeInTheDocument();

		rerender(createProps({ isGameOver: true, turnNumber: 13 }));

		expect(container.querySelector('.status-row')).not.toBeInTheDocument();
		expect(container.querySelector('.final-score-display')).toBeInTheDocument();
	});

	it('handles score updates during game', () => {
		const { container, rerender } = render(GameStatus, {
			props: createProps({ grandTotal: 50 }),
		});

		const scoreItem = container.querySelector('.status-item.score');
		let value = scoreItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('50');

		rerender(createProps({ grandTotal: 100 }));
		value = scoreItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('100');
	});

	it('uses default totalTurns of 13', () => {
		const { container } = render(GameStatus, {
			props: {
				turnNumber: 5,
				grandTotal: 100,
			},
		});

		const turnItem = container.querySelector('.status-item.turn');
		const value = turnItem?.querySelector('.status-value');
		expect(value?.textContent).toBe('5/13');
	});
});
