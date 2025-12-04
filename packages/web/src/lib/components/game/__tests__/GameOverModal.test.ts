/**
 * GameOverModal Component Tests
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import GameOverModal from '../GameOverModal.svelte';

describe('GameOverModal', () => {
	const defaultProps = {
		upperSubtotal: 45,
		upperBonus: 35,
		lowerTotal: 120,
		grandTotal: 200,
		onPlayAgain: vi.fn(),
	};

	it('renders game complete title', () => {
		render(GameOverModal, { props: defaultProps });
		expect(screen.getByText('Game Complete!')).toBeInTheDocument();
	});

	it('displays upper section score', () => {
		render(GameOverModal, { props: defaultProps });
		expect(screen.getByText('Upper Section')).toBeInTheDocument();
		expect(screen.getByText('45')).toBeInTheDocument();
	});

	it('displays upper bonus when earned', () => {
		render(GameOverModal, { props: defaultProps });
		expect(screen.getByText('Upper Bonus')).toBeInTheDocument();
		expect(screen.getByText('+35')).toBeInTheDocument();
	});

	it('hides upper bonus when not earned', () => {
		render(GameOverModal, {
			props: { ...defaultProps, upperBonus: 0 },
		});
		expect(screen.queryByText('Upper Bonus')).not.toBeInTheDocument();
	});

	it('displays lower section score', () => {
		render(GameOverModal, { props: defaultProps });
		expect(screen.getByText('Lower Section')).toBeInTheDocument();
		expect(screen.getByText('120')).toBeInTheDocument();
	});

	it('displays grand total', () => {
		render(GameOverModal, { props: defaultProps });
		expect(screen.getByText('Grand Total')).toBeInTheDocument();
		expect(screen.getByText('200')).toBeInTheDocument();
	});

	it('calls onPlayAgain when button clicked', async () => {
		const onPlayAgain = vi.fn();
		render(GameOverModal, { props: { ...defaultProps, onPlayAgain } });

		const button = screen.getByText('Play Again');
		await fireEvent.click(button);

		expect(onPlayAgain).toHaveBeenCalledOnce();
	});

	it('has proper accessibility attributes', () => {
		render(GameOverModal, { props: defaultProps });
		const dialog = screen.getByRole('dialog');
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(dialog).toHaveAttribute('aria-labelledby', 'game-over-title');
	});

	describe('score breakdown variations', () => {
		it('handles zero scores', () => {
			render(GameOverModal, {
				props: {
					upperSubtotal: 0,
					upperBonus: 0,
					lowerTotal: 0,
					grandTotal: 0,
					onPlayAgain: vi.fn(),
				},
			});
			expect(screen.getByText('Grand Total')).toBeInTheDocument();
		});

		it('handles high scores', () => {
			render(GameOverModal, {
				props: {
					upperSubtotal: 84,
					upperBonus: 35,
					lowerTotal: 236,
					grandTotal: 355,
					onPlayAgain: vi.fn(),
				},
			});
			expect(screen.getByText('355')).toBeInTheDocument();
		});

		it('handles scores without bonus', () => {
			render(GameOverModal, {
				props: {
					upperSubtotal: 50,
					upperBonus: 0,
					lowerTotal: 100,
					grandTotal: 150,
					onPlayAgain: vi.fn(),
				},
			});
			expect(screen.queryByText('Upper Bonus')).not.toBeInTheDocument();
			expect(screen.getByText('150')).toBeInTheDocument();
		});
	});
});
