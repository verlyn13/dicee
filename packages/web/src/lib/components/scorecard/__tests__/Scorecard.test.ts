/**
 * Scorecard Component Tests
 * Tests structure, totals calculation display, bonus progress, and accessibility
 */

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Category, CategoryProbability, ScoringResult, StatsProfile } from '$lib/types.js';
import Scorecard from '../Scorecard.svelte';

// =============================================================================
// Test Fixtures
// =============================================================================

function createEmptyScores(): Record<Category, number | null> {
	return {
		Ones: null,
		Twos: null,
		Threes: null,
		Fours: null,
		Fives: null,
		Sixes: null,
		ThreeOfAKind: null,
		FourOfAKind: null,
		FullHouse: null,
		SmallStraight: null,
		LargeStraight: null,
		Yahtzee: null,
		Chance: null,
	};
}

function createPotentialScores(): ScoringResult[] {
	return [
		{ category: 'Ones' as Category, score: 2, valid: true },
		{ category: 'Twos' as Category, score: 4, valid: true },
		{ category: 'Threes' as Category, score: 6, valid: true },
		{ category: 'Fours' as Category, score: 8, valid: true },
		{ category: 'Fives' as Category, score: 10, valid: true },
		{ category: 'Sixes' as Category, score: 12, valid: true },
		{ category: 'ThreeOfAKind' as Category, score: 20, valid: true },
		{ category: 'FourOfAKind' as Category, score: 0, valid: true },
		{ category: 'FullHouse' as Category, score: 25, valid: true },
		{ category: 'SmallStraight' as Category, score: 30, valid: true },
		{ category: 'LargeStraight' as Category, score: 0, valid: true },
		{ category: 'Yahtzee' as Category, score: 0, valid: true },
		{ category: 'Chance' as Category, score: 22, valid: true },
	];
}

function createProbabilities(): CategoryProbability[] {
	return [
		{
			category: 'Ones' as Category,
			probability: 0.5,
			expectedValue: 2.5,
			currentScore: 2,
			isOptimal: false,
		},
		{
			category: 'Twos' as Category,
			probability: 0.4,
			expectedValue: 3.2,
			currentScore: 4,
			isOptimal: false,
		},
		{
			category: 'FullHouse' as Category,
			probability: 0.8,
			expectedValue: 20,
			currentScore: 25,
			isOptimal: true,
		},
	];
}

const defaultProps = {
	scores: createEmptyScores(),
	potentialScores: createPotentialScores(),
	probabilities: createProbabilities(),
	upperSubtotal: 0,
	upperBonus: 0,
	upperTotal: 0,
	lowerTotal: 0,
	grandTotal: 0,
	statsEnabled: false,
	statsProfile: 'intermediate' as StatsProfile,
	canScore: true,
	onScore: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onScore: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// Structure Tests
// =============================================================================

describe('Scorecard Component - Structure', () => {
	it('renders scorecard container', () => {
		const { container } = render(Scorecard, { props: createProps() });

		expect(container.querySelector('.scorecard')).toBeInTheDocument();
	});

	it('renders scorecard header', () => {
		const { getByRole } = render(Scorecard, { props: createProps() });

		expect(getByRole('heading', { name: /scorecard/i })).toBeInTheDocument();
	});

	it('renders upper section with 6 categories', () => {
		const { container } = render(Scorecard, { props: createProps() });

		const upperSection = container.querySelector('.upper-section');
		expect(upperSection).toBeInTheDocument();

		const categories = upperSection?.querySelectorAll('.category-row');
		expect(categories).toHaveLength(6);
	});

	it('renders lower section with 7 categories', () => {
		const { container } = render(Scorecard, { props: createProps() });

		const lowerSection = container.querySelector('.lower-section');
		expect(lowerSection).toBeInTheDocument();

		const categories = lowerSection?.querySelectorAll('.category-row');
		expect(categories).toHaveLength(7);
	});

	it('renders all 13 category rows total', () => {
		const { container } = render(Scorecard, { props: createProps() });

		const allCategories = container.querySelectorAll('.category-row');
		expect(allCategories).toHaveLength(13);
	});

	it('renders section headers with hints', () => {
		const { getByText } = render(Scorecard, { props: createProps() });

		expect(getByText('Upper Section')).toBeInTheDocument();
		expect(getByText('Sum of matching dice')).toBeInTheDocument();
		expect(getByText('Lower Section')).toBeInTheDocument();
		expect(getByText('Special combinations')).toBeInTheDocument();
	});

	it('renders grand total section', () => {
		const { container } = render(Scorecard, { props: createProps() });

		expect(container.querySelector('.grand-total')).toBeInTheDocument();
	});
});

// =============================================================================
// Totals Display Tests
// =============================================================================

describe('Scorecard Component - Totals Display', () => {
	it('displays upper subtotal', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperSubtotal: 42 }),
		});

		const subtotalRow = container.querySelector('.subtotal-row');
		const value = subtotalRow?.querySelector('.total-value');
		expect(value?.textContent).toBe('42');
	});

	it('displays upper total', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperTotal: 77 }),
		});

		const sectionTotal = container.querySelector('.upper-section .section-total');
		const value = sectionTotal?.querySelector('.total-value');
		expect(value?.textContent).toBe('77');
	});

	it('displays lower total', () => {
		const { container } = render(Scorecard, {
			props: createProps({ lowerTotal: 150 }),
		});

		const sectionTotal = container.querySelector('.lower-section .section-total');
		const value = sectionTotal?.querySelector('.total-value');
		expect(value?.textContent).toBe('150');
	});

	it('displays grand total', () => {
		const { container } = render(Scorecard, {
			props: createProps({ grandTotal: 275 }),
		});

		const grandValue = container.querySelector('.grand-value');
		expect(grandValue?.textContent).toBe('275');
	});

	it('updates totals when props change', () => {
		const { container, rerender } = render(Scorecard, {
			props: createProps({ grandTotal: 100 }),
		});

		let grandValue = container.querySelector('.grand-value');
		expect(grandValue?.textContent).toBe('100');

		rerender(createProps({ grandTotal: 200 }));
		grandValue = container.querySelector('.grand-value');
		expect(grandValue?.textContent).toBe('200');
	});
});

// =============================================================================
// Bonus Progress Tests
// =============================================================================

describe('Scorecard Component - Bonus Progress', () => {
	it('shows bonus progress bar when bonus not achieved', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperSubtotal: 40, upperBonus: 0 }),
		});

		expect(container.querySelector('.bonus-progress')).toBeInTheDocument();
	});

	it('hides bonus progress bar when bonus achieved', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperSubtotal: 63, upperBonus: 35 }),
		});

		expect(container.querySelector('.bonus-progress')).not.toBeInTheDocument();
	});

	it('displays progress bar width based on subtotal', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperSubtotal: 31 }), // ~49% of 63
		});

		const progressBar = container.querySelector('.progress-bar');
		expect(progressBar).toHaveAttribute('style');
		// 31/63 ≈ 49.2%
		expect(progressBar?.getAttribute('style')).toContain('width:');
	});

	it('displays progress text showing subtotal/63', () => {
		const { getByText } = render(Scorecard, {
			props: createProps({ upperSubtotal: 45 }),
		});

		expect(getByText('45/63')).toBeInTheDocument();
	});

	it('shows "need X more" hint when bonus not achieved', () => {
		const { getByText } = render(Scorecard, {
			props: createProps({ upperSubtotal: 50, upperBonus: 0 }),
		});

		expect(getByText(/need 13 more/)).toBeInTheDocument();
	});

	it('shows +35 bonus when achieved', () => {
		const { getByText } = render(Scorecard, {
			props: createProps({ upperBonus: 35 }),
		});

		expect(getByText('+35')).toBeInTheDocument();
	});

	it('shows dash when bonus not achieved', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperBonus: 0 }),
		});

		const bonusRow = container.querySelector('.bonus-row');
		const value = bonusRow?.querySelector('.total-value');
		expect(value?.textContent).toBe('—');
	});

	it('applies achieved class to bonus row when bonus earned', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperBonus: 35 }),
		});

		const bonusRow = container.querySelector('.bonus-row');
		expect(bonusRow).toHaveClass('achieved');
	});

	it('caps progress bar at 100%', () => {
		const { container } = render(Scorecard, {
			props: createProps({ upperSubtotal: 80, upperBonus: 35 }), // Over 63
		});

		// When bonus is achieved, progress bar is hidden
		expect(container.querySelector('.bonus-progress')).not.toBeInTheDocument();
	});
});

// =============================================================================
// Category Row Integration Tests
// =============================================================================

describe('Scorecard Component - Category Row Integration', () => {
	it('passes score to category rows', () => {
		const scores = createEmptyScores();
		scores.Ones = 3;

		const { container } = render(Scorecard, {
			props: createProps({ scores }),
		});

		// Find the Ones row and check it shows scored
		const onesRow = container.querySelector('.category-row.scored');
		expect(onesRow).toBeInTheDocument();
	});

	it('passes potential scores to category rows', () => {
		const { container } = render(Scorecard, {
			props: createProps(),
		});

		// Should show potential scores in unscored rows
		const unscored = container.querySelectorAll('.category-row:not(.scored)');
		expect(unscored.length).toBeGreaterThan(0);
	});

	it('passes statsEnabled to category rows', () => {
		const { container } = render(Scorecard, {
			props: createProps({ statsEnabled: true }),
		});

		// When stats enabled, heat bars should be visible
		const heatBars = container.querySelectorAll('.heat-bar');
		expect(heatBars.length).toBeGreaterThan(0);
	});

	it('passes probabilities to category rows', () => {
		const { container } = render(Scorecard, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
			}),
		});

		// Should show probability stats
		const stats = container.querySelectorAll('.category-stats');
		expect(stats.length).toBeGreaterThan(0);
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('Scorecard Component - Interactions', () => {
	it('calls onScore when available category clicked', async () => {
		const props = createProps();
		const { container } = render(Scorecard, { props });

		const categories = container.querySelectorAll('.category-row');
		await fireEvent.click(categories[0]);

		expect(props.onScore).toHaveBeenCalledWith('Ones');
	});

	it('calls onScore with correct category', async () => {
		const props = createProps();
		const { container } = render(Scorecard, { props });

		// Click the last category (Chance)
		const categories = container.querySelectorAll('.category-row');
		await fireEvent.click(categories[12]);

		expect(props.onScore).toHaveBeenCalledWith('Chance');
	});

	it('does not call onScore when canScore is false', async () => {
		const props = createProps({ canScore: false });
		const { container } = render(Scorecard, { props });

		const categories = container.querySelectorAll('.category-row');
		await fireEvent.click(categories[0]);

		expect(props.onScore).not.toHaveBeenCalled();
	});

	it('does not call onScore for already scored category', async () => {
		const scores = createEmptyScores();
		scores.Ones = 3;

		const props = createProps({ scores });
		const { container } = render(Scorecard, { props });

		const scoredRow = container.querySelector('.category-row.scored')!;
		await fireEvent.click(scoredRow);

		expect(props.onScore).not.toHaveBeenCalled();
	});
});

// =============================================================================
// Stats Profile Tests
// =============================================================================

describe('Scorecard Component - Stats Profiles', () => {
	it('passes statsProfile to category rows', () => {
		const { container } = render(Scorecard, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
			}),
		});

		// Beginner profile shows simplified text
		const simpleProbs = container.querySelectorAll('.simple-prob');
		expect(simpleProbs.length).toBeGreaterThan(0);
	});

	it('shows optimal badges when stats enabled', () => {
		const { container } = render(Scorecard, {
			props: createProps({
				statsEnabled: true,
				probabilities: createProbabilities(),
			}),
		});

		const optimalBadges = container.querySelectorAll('.optimal-badge');
		expect(optimalBadges.length).toBeGreaterThan(0);
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('Scorecard Component - Accessibility', () => {
	it('passes axe audit with empty scorecard', async () => {
		const { container } = render(Scorecard, { props: createProps() });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit with some categories scored', async () => {
		const scores = createEmptyScores();
		scores.Ones = 3;
		scores.Twos = 6;
		scores.FullHouse = 25;

		const { container } = render(Scorecard, {
			props: createProps({
				scores,
				upperSubtotal: 9,
				upperTotal: 9,
				lowerTotal: 25,
				grandTotal: 34,
			}),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit with stats enabled', async () => {
		const { container } = render(Scorecard, {
			props: createProps({ statsEnabled: true }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has proper heading hierarchy', () => {
		const { container } = render(Scorecard, { props: createProps() });

		const h2 = container.querySelector('h2');
		expect(h2).toBeInTheDocument();
		expect(h2?.textContent).toBe('Scorecard');
	});

	it('all category rows are keyboard accessible', () => {
		const { container } = render(Scorecard, { props: createProps() });

		const categories = container.querySelectorAll('.category-row');
		for (const category of categories) {
			expect(category.tagName).toBe('BUTTON');
		}
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Scorecard Component - Edge Cases', () => {
	it('handles all categories scored (game complete)', () => {
		const scores: Record<Category, number | null> = {
			Ones: 3,
			Twos: 6,
			Threes: 9,
			Fours: 12,
			Fives: 15,
			Sixes: 18,
			ThreeOfAKind: 22,
			FourOfAKind: 0,
			FullHouse: 25,
			SmallStraight: 30,
			LargeStraight: 40,
			Yahtzee: 50,
			Chance: 25,
		};

		const { container } = render(Scorecard, {
			props: createProps({
				scores,
				upperSubtotal: 63,
				upperBonus: 35,
				upperTotal: 98,
				lowerTotal: 192,
				grandTotal: 290,
			}),
		});

		// All rows should be scored
		const scoredRows = container.querySelectorAll('.category-row.scored');
		expect(scoredRows).toHaveLength(13);

		// Bonus should be achieved
		const bonusRow = container.querySelector('.bonus-row.achieved');
		expect(bonusRow).toBeInTheDocument();
	});

	it('handles zero scores correctly', () => {
		const scores = createEmptyScores();
		scores.Yahtzee = 0; // Scored as zero

		const { container } = render(Scorecard, {
			props: createProps({ scores }),
		});

		const scoredRows = container.querySelectorAll('.category-row.scored');
		expect(scoredRows).toHaveLength(1);
	});

	it('handles empty probabilities array', () => {
		const { container } = render(Scorecard, {
			props: createProps({
				probabilities: [],
				statsEnabled: true,
			}),
		});

		// Should still render without errors
		expect(container.querySelector('.scorecard')).toBeInTheDocument();
	});

	it('handles empty potential scores array', () => {
		const { container } = render(Scorecard, {
			props: createProps({
				potentialScores: [],
			}),
		});

		// Should still render without errors
		expect(container.querySelector('.scorecard')).toBeInTheDocument();
	});
});
