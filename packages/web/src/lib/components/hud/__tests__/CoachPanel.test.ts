/**
 * CoachPanel Component Tests
 * Tests coach feedback display, suggestions, and training mode confirmation
 */

import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { coach } from '$lib/stores/coach.svelte';
import type { TurnAnalysis } from '$lib/types';
import CoachPanel from '../CoachPanel.svelte';

// =============================================================================
// Test Setup
// =============================================================================

const defaultProps = {
	analysis: undefined as TurnAnalysis | undefined,
	dice: [1, 2, 3, 4, 5] as [number, number, number, number, number],
	rollsRemaining: 2,
	onDismiss: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onDismiss: vi.fn(),
		...overrides,
	};
}

function createMockAnalysis(overrides: Partial<TurnAnalysis> = {}): TurnAnalysis {
	return {
		action: 'score',
		expectedValue: 25.5,
		recommendedCategory: 'Threes',
		categoryScore: 9,
		keepRecommendation: undefined,
		categories: [],
		...overrides,
	};
}

describe('CoachPanel', () => {
	beforeEach(() => {
		coach.__testing.reset();
		vi.clearAllMocks();
	});

	// ===========================================================================
	// Panel Visibility
	// ===========================================================================

	describe('panel visibility', () => {
		it('does not render when coach is off', () => {
			coach.setLevel('off');

			const { container } = render(CoachPanel, {
				props: createProps({ analysis: createMockAnalysis() }),
			});

			expect(container.querySelector('.coach-panel')).not.toBeInTheDocument();
		});

		it('renders when coach mode is active with feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'optimal',
				message: 'Great choice!',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(container.querySelector('.coach-panel')).toBeInTheDocument();
		});

		it('renders when coach mode has suggestions', () => {
			coach.setLevel('coach');

			const { container } = render(CoachPanel, {
				props: createProps({ analysis: createMockAnalysis() }),
			});

			expect(container.querySelector('.coach-panel')).toBeInTheDocument();
		});

		it('does not render in hints mode without feedback', () => {
			coach.setLevel('hints');

			const { container } = render(CoachPanel, {
				props: createProps({ analysis: createMockAnalysis() }),
			});

			// Hints mode doesn't show suggestions
			expect(container.querySelector('.coach-panel')).not.toBeInTheDocument();
		});
	});

	// ===========================================================================
	// Feedback Display
	// ===========================================================================

	describe('feedback display', () => {
		it('shows optimal feedback message', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'optimal',
				message: 'Perfect play!',
			});

			const { getByText, container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('Perfect play!')).toBeInTheDocument();
			expect(container.querySelector('.feedback-optimal')).toBeInTheDocument();
		});

		it('shows suboptimal feedback with EV loss', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'suboptimal',
				message: 'Full House would be better',
				evLoss: 5.3,
			});

			const { getByText, container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('Full House would be better')).toBeInTheDocument();
			expect(getByText('-5.3 EV')).toBeInTheDocument();
			expect(container.querySelector('.feedback-suboptimal')).toBeInTheDocument();
		});

		it('shows warning feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'warning',
				message: 'This is a risky choice',
			});

			const { getByText, container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('This is a risky choice')).toBeInTheDocument();
			expect(container.querySelector('.feedback-warning')).toBeInTheDocument();
		});

		it('shows info feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Consider your options',
			});

			const { getByText, container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('Consider your options')).toBeInTheDocument();
			expect(container.querySelector('.feedback-info')).toBeInTheDocument();
		});

		it('shows correct icon for optimal feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'optimal',
				message: 'Great!',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			const icon = container.querySelector('.feedback-icon');
			expect(icon?.textContent?.trim()).toBe('✓');
		});

		it('shows correct icon for suboptimal feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'suboptimal',
				message: 'Not ideal',
				evLoss: 2.5,
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			const icon = container.querySelector('.feedback-icon');
			expect(icon?.textContent?.trim()).toBe('↓');
		});
	});

	// ===========================================================================
	// Dismiss Functionality
	// ===========================================================================

	describe('dismiss functionality', () => {
		it('shows dismiss button on feedback', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Test message',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(container.querySelector('.dismiss-btn')).toBeInTheDocument();
		});

		it('clears feedback on dismiss click', async () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Test message',
			});

			const onDismiss = vi.fn();
			const { container } = render(CoachPanel, {
				props: createProps({ onDismiss }),
			});

			const dismissBtn = container.querySelector('.dismiss-btn')!;
			await fireEvent.click(dismissBtn);

			expect(coach.lastFeedback).toBeNull();
			expect(onDismiss).toHaveBeenCalled();
		});
	});

	// ===========================================================================
	// Suggestions (Coach/Training Mode)
	// ===========================================================================

	describe('suggestions', () => {
		it('shows score suggestion when analysis recommends scoring', () => {
			coach.setLevel('coach');

			const { getByText } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis({
						action: 'score',
						recommendedCategory: 'FullHouse',
						categoryScore: 25,
						expectedValue: 28.5,
					}),
				}),
			});

			expect(getByText('Score Full House')).toBeInTheDocument();
			expect(getByText('for 25 points')).toBeInTheDocument();
		});

		it('shows EV for suggestion', () => {
			coach.setLevel('coach');

			const { getByText } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis({
						expectedValue: 32.7,
					}),
				}),
			});

			expect(getByText('EV: 32.7')).toBeInTheDocument();
		});

		it('shows reroll suggestion with keep pattern', () => {
			coach.setLevel('coach');

			const { getByText } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis({
						action: 'reroll',
						recommendedCategory: undefined,
						categoryScore: undefined,
						keepRecommendation: {
							keepPattern: [0, 0, 3, 0, 0, 0] as [number, number, number, number, number, number],
							expectedValue: 30.5,
							explanation: 'Building toward threes',
						},
						expectedValue: 30.5,
					}),
				}),
			});

			expect(getByText(/Keep/)).toBeInTheDocument();
			expect(getByText('Building toward threes')).toBeInTheDocument();
		});

		it('shows "Roll all" when keep pattern is empty', () => {
			coach.setLevel('coach');

			const { getByText } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis({
						action: 'reroll',
						keepRecommendation: {
							keepPattern: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
							expectedValue: 20.0,
							explanation: 'Start fresh',
						},
						expectedValue: 20.0,
					}),
				}),
			});

			expect(getByText(/Roll all/)).toBeInTheDocument();
		});

		it('does not show suggestion when feedback is displayed', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'optimal',
				message: 'Great choice!',
			});

			const { container, queryByText } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis({
						action: 'score',
						recommendedCategory: 'Fours',
					}),
				}),
			});

			// Should show feedback, not suggestion
			expect(queryByText('Score Fours')).not.toBeInTheDocument();
			expect(container.querySelector('.suggestion')).not.toBeInTheDocument();
		});

		it('shows suggestion header with icon', () => {
			coach.setLevel('coach');

			const { getByText, container } = render(CoachPanel, {
				props: createProps({
					analysis: createMockAnalysis(),
				}),
			});

			expect(getByText('Suggested')).toBeInTheDocument();
			expect(container.querySelector('.suggestion-icon')).toBeInTheDocument();
		});
	});

	// ===========================================================================
	// Training Mode Confirmation Modal
	// ===========================================================================

	describe('training mode confirmation modal', () => {
		it('shows modal when pending decision exists', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				category: 'Ones',
				isOptimal: false,
				chosenEV: 15.0,
				optimalEV: 28.5,
				explanation: 'Full House would be better',
			});

			const { container, getByText } = render(CoachPanel, {
				props: createProps(),
			});

			expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();
			expect(getByText('Suboptimal Score')).toBeInTheDocument();
		});

		it('shows correct title for reroll decision', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'reroll',
				isOptimal: false,
				chosenEV: 10.0,
				optimalEV: 25.0,
			});

			const { getByText } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('Suboptimal Reroll')).toBeInTheDocument();
		});

		it('shows EV comparison', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 12.5,
				optimalEV: 30.0,
			});

			const { getByText } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('12.5')).toBeInTheDocument();
			expect(getByText('30.0')).toBeInTheDocument();
		});

		it('shows explanation when provided', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 15.0,
				optimalEV: 28.5,
				explanation: 'This is a detailed explanation',
			});

			const { getByText } = render(CoachPanel, {
				props: createProps(),
			});

			expect(getByText('This is a detailed explanation')).toBeInTheDocument();
		});

		it('calculates EV loss when no explanation', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 10.0,
				optimalEV: 20.5,
			});

			const { getByText } = render(CoachPanel, {
				props: createProps(),
			});

			// 20.5 - 10.0 = 10.5
			expect(getByText('10.5')).toBeInTheDocument();
		});

		it('closes modal on confirm', async () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 10.0,
				optimalEV: 20.0,
			});

			const { container, getByText } = render(CoachPanel, {
				props: createProps(),
			});

			const proceedBtn = getByText('Proceed anyway');
			await fireEvent.click(proceedBtn);

			expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			expect(coach.pendingDecision).toBeNull();
		});

		it('closes modal on cancel', async () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 10.0,
				optimalEV: 20.0,
			});

			const { container, getByText } = render(CoachPanel, {
				props: createProps(),
			});

			const cancelBtn = getByText('Let me reconsider');
			await fireEvent.click(cancelBtn);

			expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			expect(coach.pendingDecision).toBeNull();
		});

		it('has correct ARIA attributes for modal', () => {
			coach.setLevel('training');
			coach.requestConfirmation({
				type: 'score',
				isOptimal: false,
				chosenEV: 10.0,
				optimalEV: 20.0,
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			const modal = container.querySelector('.confirm-modal');
			expect(modal?.getAttribute('role')).toBe('alertdialog');
			expect(modal?.getAttribute('aria-labelledby')).toBe('confirm-title');
		});
	});

	// ===========================================================================
	// Accessibility
	// ===========================================================================

	describe('accessibility', () => {
		it('uses role="status" for panel', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Test',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(container.querySelector('[role="status"]')).toBeInTheDocument();
		});

		it('uses aria-live="polite" for updates', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Test',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
		});

		it('dismiss button has aria-label', () => {
			coach.setLevel('coach');
			coach.setFeedback({
				type: 'info',
				message: 'Test',
			});

			const { container } = render(CoachPanel, {
				props: createProps(),
			});

			const dismissBtn = container.querySelector('.dismiss-btn');
			expect(dismissBtn?.getAttribute('aria-label')).toBe('Dismiss');
		});
	});
});
