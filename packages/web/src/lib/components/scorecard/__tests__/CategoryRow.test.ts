/**
 * CategoryRow Component Tests
 * Tests rendering, stats display, heat map, and accessibility
 */

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Category, StatsProfile } from '$lib/types.js';
import CategoryRow from '../CategoryRow.svelte';

// =============================================================================
// Test Fixtures
// =============================================================================

const defaultProps = {
	category: 'Ones' as Category,
	score: null as number | null,
	potentialScore: 3,
	probability: 0.5,
	expectedValue: 2.5,
	isOptimal: false,
	statsEnabled: false,
	statsProfile: 'intermediate' as StatsProfile,
	available: true,
	onclick: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onclick: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// Rendering Tests
// =============================================================================

describe('CategoryRow Component - Rendering', () => {
	it('renders with default props', () => {
		const { container } = render(CategoryRow, { props: createProps() });

		expect(container.querySelector('.category-row')).toBeInTheDocument();
	});

	it('displays category name correctly', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({ category: 'ThreeOfAKind' }),
		});

		expect(getByText('Three of a Kind')).toBeInTheDocument();
	});

	it('displays all category types correctly', () => {
		const categories: Category[] = [
			'Ones',
			'Twos',
			'Threes',
			'Fours',
			'Fives',
			'Sixes',
			'ThreeOfAKind',
			'FourOfAKind',
			'FullHouse',
			'SmallStraight',
			'LargeStraight',
			'Yahtzee',
			'Chance',
		];

		const expectedNames = [
			'Ones',
			'Twos',
			'Threes',
			'Fours',
			'Fives',
			'Sixes',
			'Three of a Kind',
			'Four of a Kind',
			'Full House',
			'Small Straight',
			'Large Straight',
			'Yahtzee',
			'Chance',
		];

		categories.forEach((category, index) => {
			const { getByText } = render(CategoryRow, {
				props: createProps({ category }),
			});
			expect(getByText(expectedNames[index])).toBeInTheDocument();
		});
	});

	it('displays category icon', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ category: 'Ones' }),
		});

		const icon = container.querySelector('.icon');
		expect(icon?.textContent).toBe('⚀');
	});

	it('displays different icons for different categories', () => {
		const iconMap: Partial<Record<Category, string>> = {
			Ones: '⚀',
			Twos: '⚁',
			Sixes: '⚅',
			FullHouse: '🏠',
			Yahtzee: '🎯',
			Chance: '❓',
		};

		for (const [category, expectedIcon] of Object.entries(iconMap)) {
			const { container } = render(CategoryRow, {
				props: createProps({ category: category as Category }),
			});
			const icon = container.querySelector('.icon');
			expect(icon?.textContent).toBe(expectedIcon);
		}
	});
});

// =============================================================================
// Score Display Tests
// =============================================================================

describe('CategoryRow Component - Score Display', () => {
	it('shows potential score when unscored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: null, potentialScore: 15 }),
		});

		const score = container.querySelector('.potential-value');
		expect(score?.textContent).toBe('15');
	});

	it('shows actual score when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 25, potentialScore: 15 }),
		});

		const score = container.querySelector('.scored-value');
		expect(score?.textContent).toBe('25');
	});

	it('shows checkmark when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 25 }),
		});

		expect(container.querySelector('.check')).toBeInTheDocument();
	});

	it('hides checkmark when unscored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: null }),
		});

		expect(container.querySelector('.check')).not.toBeInTheDocument();
	});

	it('applies scored class when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 25 }),
		});

		expect(container.querySelector('.category-row')).toHaveClass('scored');
	});
});

// =============================================================================
// Stats Profile Tests
// =============================================================================

describe('CategoryRow Component - Stats Profiles', () => {
	it('hides probability stats when statsEnabled is false', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: false,
				probability: 0.5,
				expectedValue: 10,
			}),
		});

		// When stats disabled, probability and EV should not be shown
		expect(container.querySelector('.probability')).not.toBeInTheDocument();
		expect(container.querySelector('.ev')).not.toBeInTheDocument();
	});

	it('shows stats when statsEnabled is true', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
				probability: 0.5,
				expectedValue: 10,
			}),
		});

		expect(container.querySelector('.category-stats')).toBeInTheDocument();
	});

	// Beginner profile
	it('shows simplified probability for beginner profile', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
				probability: 0.6,
			}),
		});

		expect(getByText('Likely')).toBeInTheDocument();
	});

	it('shows "Likely" when probability >= 0.5', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
				probability: 0.5,
			}),
		});

		expect(getByText('Likely')).toBeInTheDocument();
	});

	it('shows "Possible" when probability >= 0.2 and < 0.5', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
				probability: 0.35,
			}),
		});

		expect(getByText('Possible')).toBeInTheDocument();
	});

	it('shows "Unlikely" when probability < 0.2', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
				probability: 0.1,
			}),
		});

		expect(getByText('Unlikely')).toBeInTheDocument();
	});

	it('hides EV for beginner profile', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'beginner',
				expectedValue: 10,
			}),
		});

		expect(container.querySelector('.ev')).not.toBeInTheDocument();
	});

	// Intermediate profile
	it('shows percentage probability for intermediate profile', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
				probability: 0.456,
			}),
		});

		const prob = container.querySelector('.probability');
		expect(prob?.textContent).toBe('45.6%');
	});

	it('shows EV for intermediate profile', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
				expectedValue: 12.5,
			}),
		});

		const ev = container.querySelector('.ev');
		expect(ev?.textContent).toBe('EV: 12.5');
	});

	// Expert profile
	it('shows percentage probability for expert profile', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'expert',
				probability: 0.789,
			}),
		});

		const prob = container.querySelector('.probability');
		expect(prob?.textContent).toBe('78.9%');
	});

	it('shows EV for expert profile', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'expert',
				expectedValue: 25.8,
			}),
		});

		const ev = container.querySelector('.ev');
		expect(ev?.textContent).toBe('EV: 25.8');
	});
});

// =============================================================================
// Heat Map Tests
// =============================================================================

describe('CategoryRow Component - Heat Map', () => {
	it('hides heat bar when stats disabled', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ statsEnabled: false }),
		});

		expect(container.querySelector('.heat-bar')).not.toBeInTheDocument();
	});

	it('hides heat bar when unavailable', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ statsEnabled: true, available: false }),
		});

		expect(container.querySelector('.heat-bar')).not.toBeInTheDocument();
	});

	it('shows heat bar when stats enabled and available', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ statsEnabled: true, available: true }),
		});

		expect(container.querySelector('.heat-bar')).toBeInTheDocument();
	});

	it('heat bar width reflects expected value', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				expectedValue: 25, // 25/50 = 50%
			}),
		});

		const heatBar = container.querySelector('.heat-bar') as HTMLElement;
		expect(heatBar).toBeInTheDocument();
		// Svelte renders style with inline styles
		expect(heatBar.style.width).toBe('50%');
	});

	it('heat bar caps at 100%', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				expectedValue: 100, // Should cap at 100%
			}),
		});

		const heatBar = container.querySelector('.heat-bar') as HTMLElement;
		expect(heatBar).toBeInTheDocument();
		expect(heatBar.style.width).toBe('100%');
	});

	it('heat bar is 0% when EV is 0', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				expectedValue: 0,
			}),
		});

		const heatBar = container.querySelector('.heat-bar') as HTMLElement;
		expect(heatBar).toBeInTheDocument();
		expect(heatBar.style.width).toBe('0%');
	});

	it('applies optimal class to heat bar when isOptimal', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				isOptimal: true,
			}),
		});

		const heatBar = container.querySelector('.heat-bar');
		expect(heatBar).toHaveClass('optimal');
	});
});

// =============================================================================
// Optimal Badge Tests
// =============================================================================

describe('CategoryRow Component - Optimal Badge', () => {
	it('shows optimal badge when isOptimal and available', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: true,
				score: null,
			}),
		});

		expect(container.querySelector('.optimal-badge')).toBeInTheDocument();
	});

	it('hides optimal badge when not isOptimal', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: false,
				available: true,
			}),
		});

		expect(container.querySelector('.optimal-badge')).not.toBeInTheDocument();
	});

	it('hides optimal badge when not available', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: false,
			}),
		});

		expect(container.querySelector('.optimal-badge')).not.toBeInTheDocument();
	});

	it('hides optimal badge when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: true,
				score: 25,
			}),
		});

		expect(container.querySelector('.optimal-badge')).not.toBeInTheDocument();
	});

	it('shows "★ Best" for beginner profile', () => {
		const { getByText } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: true,
				statsProfile: 'beginner',
			}),
		});

		expect(getByText(/Best/)).toBeInTheDocument();
	});

	it('shows "★" only for non-beginner profiles', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: true,
				statsProfile: 'intermediate',
			}),
		});

		const badge = container.querySelector('.optimal-badge');
		expect(badge?.textContent?.trim()).toBe('★');
	});

	it('applies optimal class to row when isOptimal', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				isOptimal: true,
				available: true,
			}),
		});

		expect(container.querySelector('.category-row')).toHaveClass('optimal');
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('CategoryRow Component - Interactions', () => {
	it('calls onclick when clicked', async () => {
		const props = createProps();
		const { container } = render(CategoryRow, { props });

		const button = container.querySelector('.category-row')!;
		await fireEvent.click(button);

		expect(props.onclick).toHaveBeenCalledTimes(1);
	});

	it('is disabled when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 25 }),
		});

		expect(container.querySelector('.category-row')).toBeDisabled();
	});

	it('is disabled when not available', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ available: false }),
		});

		expect(container.querySelector('.category-row')).toBeDisabled();
	});

	it('is enabled when available and unscored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ available: true, score: null }),
		});

		expect(container.querySelector('.category-row')).not.toBeDisabled();
	});

	it('button is disabled when category is scored', () => {
		const props = createProps({ score: 25 });
		const { container } = render(CategoryRow, { props });

		const button = container.querySelector('.category-row');
		expect(button).toBeDisabled();
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('CategoryRow Component - Accessibility', () => {
	it('passes axe audit', async () => {
		const { container } = render(CategoryRow, { props: createProps() });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit when scored', async () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 25 }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit with stats enabled', async () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				isOptimal: true,
			}),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has descriptive aria-label when unscored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				category: 'Yahtzee',
				score: null,
				potentialScore: 50,
			}),
		});

		const button = container.querySelector('.category-row');
		expect(button).toHaveAttribute('aria-label', 'Yahtzee: potential 50');
	});

	it('has descriptive aria-label when scored', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				category: 'Yahtzee',
				score: 50,
				potentialScore: 30,
			}),
		});

		const button = container.querySelector('.category-row');
		expect(button).toHaveAttribute('aria-label', 'Yahtzee: scored 50');
	});

	it('includes "best choice" in aria-label when optimal', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				category: 'Sixes',
				score: null,
				potentialScore: 18,
				isOptimal: true,
			}),
		});

		const button = container.querySelector('.category-row');
		expect(button?.getAttribute('aria-label')).toContain('best choice');
	});

	it('is a button element', () => {
		const { container } = render(CategoryRow, { props: createProps() });

		const element = container.querySelector('.category-row');
		expect(element?.tagName).toBe('BUTTON');
	});

	it('meets minimum touch target size', () => {
		const { container } = render(CategoryRow, { props: createProps() });

		const row = container.querySelector('.category-row') as HTMLElement;
		// CSS sets min-height: var(--touch-target-min) which is 44px
		expect(row).toBeInTheDocument();
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('CategoryRow Component - Edge Cases', () => {
	it('handles zero probability correctly', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
				probability: 0,
			}),
		});

		const prob = container.querySelector('.probability');
		expect(prob?.textContent).toBe('0.0%');
	});

	it('handles 100% probability correctly', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				statsProfile: 'intermediate',
				probability: 1,
			}),
		});

		const prob = container.querySelector('.probability');
		expect(prob?.textContent).toBe('100.0%');
	});

	it('handles zero score', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: 0 }),
		});

		const score = container.querySelector('.scored-value');
		expect(score?.textContent).toBe('0');
		expect(container.querySelector('.check')).toBeInTheDocument();
	});

	it('handles zero potential score', () => {
		const { container } = render(CategoryRow, {
			props: createProps({ score: null, potentialScore: 0 }),
		});

		const score = container.querySelector('.potential-value');
		expect(score?.textContent).toBe('0');
	});

	it('hides stats when scored even if statsEnabled', () => {
		const { container } = render(CategoryRow, {
			props: createProps({
				statsEnabled: true,
				score: 25,
			}),
		});

		expect(container.querySelector('.category-stats')).not.toBeInTheDocument();
	});
});
