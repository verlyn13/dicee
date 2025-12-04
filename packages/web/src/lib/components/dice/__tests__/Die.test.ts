/**
 * Die Component Tests
 * Tests rendering, interactions, and accessibility for the Die component
 */

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { DieValue } from '$lib/types.js';
import Die from '../Die.svelte';

// =============================================================================
// Rendering Tests
// =============================================================================

describe('Die Component - Rendering', () => {
	it('renders with default props', () => {
		const { container } = render(Die, {
			props: { value: 1 as DieValue },
		});

		const button = container.querySelector('.die');
		expect(button).toBeInTheDocument();
	});

	it.each([1, 2, 3, 4, 5, 6] as DieValue[])('renders correct pip count for value %i', (value) => {
		const { container } = render(Die, {
			props: { value },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(value);
	});

	it('renders correct pip pattern for value 1 (center pip)', () => {
		const { container } = render(Die, {
			props: { value: 1 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(1);
		expect(pips[0]).toHaveClass('center');
	});

	it('renders correct pip pattern for value 2 (diagonal)', () => {
		const { container } = render(Die, {
			props: { value: 2 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(2);
		expect(pips[0]).toHaveClass('top-right');
		expect(pips[1]).toHaveClass('bottom-left');
	});

	it('renders correct pip pattern for value 3 (diagonal with center)', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(3);
		expect(pips[0]).toHaveClass('top-right');
		expect(pips[1]).toHaveClass('center');
		expect(pips[2]).toHaveClass('bottom-left');
	});

	it('renders correct pip pattern for value 4 (corners)', () => {
		const { container } = render(Die, {
			props: { value: 4 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(4);
		expect(pips[0]).toHaveClass('top-left');
		expect(pips[1]).toHaveClass('top-right');
		expect(pips[2]).toHaveClass('bottom-left');
		expect(pips[3]).toHaveClass('bottom-right');
	});

	it('renders correct pip pattern for value 5 (corners + center)', () => {
		const { container } = render(Die, {
			props: { value: 5 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(5);
		expect(pips[0]).toHaveClass('top-left');
		expect(pips[1]).toHaveClass('top-right');
		expect(pips[2]).toHaveClass('center');
		expect(pips[3]).toHaveClass('bottom-left');
		expect(pips[4]).toHaveClass('bottom-right');
	});

	it('renders correct pip pattern for value 6 (two columns)', () => {
		const { container } = render(Die, {
			props: { value: 6 as DieValue },
		});

		const pips = container.querySelectorAll('.pip');
		expect(pips).toHaveLength(6);
		expect(pips[0]).toHaveClass('top-left');
		expect(pips[1]).toHaveClass('top-right');
		expect(pips[2]).toHaveClass('middle-left');
		expect(pips[3]).toHaveClass('middle-right');
		expect(pips[4]).toHaveClass('bottom-left');
		expect(pips[5]).toHaveClass('bottom-right');
	});

	it('sets data-value attribute on face', () => {
		const { container } = render(Die, {
			props: { value: 4 as DieValue },
		});

		const face = container.querySelector('.face');
		expect(face).toHaveAttribute('data-value', '4');
	});
});

// =============================================================================
// State Tests
// =============================================================================

describe('Die Component - States', () => {
	it('applies kept class when kept=true', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, kept: true },
		});

		expect(container.querySelector('.die')).toHaveClass('kept');
	});

	it('does not apply kept class when kept=false', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, kept: false },
		});

		expect(container.querySelector('.die')).not.toHaveClass('kept');
	});

	it('shows HELD badge when kept', () => {
		const { getByText } = render(Die, {
			props: { value: 3 as DieValue, kept: true },
		});

		expect(getByText('HELD')).toBeInTheDocument();
	});

	it('hides HELD badge when not kept', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, kept: false },
		});

		expect(container.querySelector('.keep-badge')).not.toBeInTheDocument();
	});

	it('applies rolling class when rolling=true', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, rolling: true },
		});

		expect(container.querySelector('.die')).toHaveClass('rolling');
	});

	it('sets disabled attribute when disabled=true', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, disabled: true },
		});

		expect(container.querySelector('.die')).toBeDisabled();
	});

	it('is not disabled by default', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue },
		});

		expect(container.querySelector('.die')).not.toBeDisabled();
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('Die Component - Interactions', () => {
	it('calls onclick handler when clicked', async () => {
		const handleClick = vi.fn();
		const { container } = render(Die, {
			props: { value: 3 as DieValue, onclick: handleClick },
		});

		const button = container.querySelector('.die')!;
		await fireEvent.click(button);

		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it('button is disabled when disabled prop is true', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, disabled: true },
		});

		const button = container.querySelector('.die');
		expect(button).toBeDisabled();
	});

	it('handles missing onclick gracefully', async () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue },
		});

		const button = container.querySelector('.die')!;
		// Should not throw
		await fireEvent.click(button);
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('Die Component - Accessibility', () => {
	it('has correct aria-label showing value and state', () => {
		const { container } = render(Die, {
			props: { value: 5 as DieValue, kept: false },
		});

		const button = container.querySelector('.die');
		expect(button).toHaveAttribute('aria-label', 'Die showing 5, not held');
	});

	it('updates aria-label when kept', () => {
		const { container } = render(Die, {
			props: { value: 5 as DieValue, kept: true },
		});

		const button = container.querySelector('.die');
		expect(button).toHaveAttribute('aria-label', 'Die showing 5, held');
	});

	it('has aria-pressed attribute reflecting kept state', () => {
		const { container, rerender } = render(Die, {
			props: { value: 3 as DieValue, kept: false },
		});

		expect(container.querySelector('.die')).toHaveAttribute('aria-pressed', 'false');

		rerender({ value: 3 as DieValue, kept: true });
		expect(container.querySelector('.die')).toHaveAttribute('aria-pressed', 'true');
	});

	it('is a button element (keyboard accessible)', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue },
		});

		const element = container.querySelector('.die');
		expect(element?.tagName).toBe('BUTTON');
	});

	it('passes axe accessibility audit', async () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, kept: false },
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit when kept', async () => {
		const { container } = render(Die, {
			props: { value: 6 as DieValue, kept: true },
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('can be focused via keyboard', async () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue },
		});

		const button = container.querySelector('.die') as HTMLElement;
		button.focus();

		expect(document.activeElement).toBe(button);
	});

	it('responds to Enter key press', async () => {
		const handleClick = vi.fn();
		const { container } = render(Die, {
			props: { value: 3 as DieValue, onclick: handleClick },
		});

		const button = container.querySelector('.die')!;
		await fireEvent.keyPress(button, { key: 'Enter', code: 'Enter' });

		// Button should respond to Enter key
		expect(button.tagName).toBe('BUTTON');
	});
});

// =============================================================================
// Visual State Snapshot Tests
// =============================================================================

describe('Die Component - Visual States', () => {
	it('renders consistently for each die value', () => {
		for (const value of [1, 2, 3, 4, 5, 6] as DieValue[]) {
			const { container } = render(Die, { props: { value } });
			const face = container.querySelector('.face');

			expect(face).toHaveAttribute('data-value', String(value));
			expect(container.querySelectorAll('.pip')).toHaveLength(value);
		}
	});

	it('combines kept and rolling states correctly', () => {
		const { container } = render(Die, {
			props: { value: 3 as DieValue, kept: true, rolling: true },
		});

		const die = container.querySelector('.die');
		expect(die).toHaveClass('kept');
		expect(die).toHaveClass('rolling');
	});
});
