/**
 * CoachModeSelector Component Tests
 * Tests coach mode level selection in both compact and full display modes
 */

import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COACH_LEVEL_INFO, coach } from '$lib/stores/coach.svelte';
import CoachModeSelector from '../CoachModeSelector.svelte';

// =============================================================================
// Test Setup
// =============================================================================

const defaultProps = {
	compact: false,
	onchange: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onchange: vi.fn(),
		...overrides,
	};
}

describe('CoachModeSelector', () => {
	beforeEach(() => {
		coach.__testing.reset();
		vi.clearAllMocks();
	});

	// ===========================================================================
	// Full Mode Display
	// ===========================================================================

	describe('full mode', () => {
		it('renders full selector with header', () => {
			const { container, getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			expect(container.querySelector('.selector-full')).toBeInTheDocument();
			expect(getByText('Coach Mode')).toBeInTheDocument();
		});

		it('renders all four coach level options', () => {
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			expect(getByText('Off')).toBeInTheDocument();
			expect(getByText('Hints')).toBeInTheDocument();
			expect(getByText('Coach')).toBeInTheDocument();
			expect(getByText('Training')).toBeInTheDocument();
		});

		it('shows descriptions for each level', () => {
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			expect(getByText(COACH_LEVEL_INFO.off.description)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.hints.description)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.coach.description)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.training.description)).toBeInTheDocument();
		});

		it('highlights current selection', () => {
			coach.__testing.setPreferences({
				level: 'coach',
				showProbabilities: true,
				highlightOptimal: true,
				showEVDelta: true,
				animateSuggestions: true,
			});

			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			const selectedCard = container.querySelector('.option-card.selected');
			expect(selectedCard).toBeInTheDocument();
		});

		it('changes level on option click', async () => {
			const onchange = vi.fn();
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false, onchange }),
			});

			const trainingButton = getByText('Training').closest('button');
			await fireEvent.click(trainingButton!);

			expect(coach.level).toBe('training');
			expect(onchange).toHaveBeenCalledWith('training');
		});

		it('uses radiogroup role for accessibility', () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			expect(container.querySelector('[role="radiogroup"]')).toBeInTheDocument();
		});

		it('uses radio role for options', () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			const radios = container.querySelectorAll('[role="radio"]');
			expect(radios).toHaveLength(4);
		});

		it('sets aria-checked correctly', () => {
			coach.__testing.setPreferences({
				level: 'hints',
				showProbabilities: true,
				highlightOptimal: true,
				showEVDelta: true,
				animateSuggestions: true,
			});

			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			const checkedRadio = container.querySelector('[aria-checked="true"]');
			expect(checkedRadio).toBeInTheDocument();
		});
	});

	// ===========================================================================
	// Compact Mode Display
	// ===========================================================================

	describe('compact mode', () => {
		it('renders compact selector', () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			expect(container.querySelector('.selector-compact')).toBeInTheDocument();
		});

		it('shows current level icon and label', () => {
			coach.__testing.setPreferences({
				level: 'coach',
				showProbabilities: true,
				highlightOptimal: true,
				showEVDelta: true,
				animateSuggestions: true,
			});

			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			expect(getByText('Coach')).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.coach.icon)).toBeInTheDocument();
		});

		it('shows dropdown chevron', () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			expect(container.querySelector('.compact-chevron')).toBeInTheDocument();
		});

		it('expands dropdown on click', async () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);

			expect(container.querySelector('.compact-dropdown')).toBeInTheDocument();
		});

		it('shows all options in dropdown', async () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);

			const dropdown = container.querySelector('.compact-dropdown');
			expect(dropdown).toBeInTheDocument();

			// Check options in dropdown specifically
			const options = container.querySelectorAll('.dropdown-option');
			expect(options).toHaveLength(4);

			const labels = Array.from(options).map(
				(opt) => opt.querySelector('.option-label')?.textContent,
			);
			expect(labels).toContain('Off');
			expect(labels).toContain('Hints');
			expect(labels).toContain('Coach');
			expect(labels).toContain('Training');
		});

		it('selects option and closes dropdown', async () => {
			const onchange = vi.fn();
			const { container, getByRole } = render(CoachModeSelector, {
				props: createProps({ compact: true, onchange }),
			});

			// Open dropdown
			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);

			// Select training option
			const trainingOption = getByRole('option', { name: /Training/ });
			await fireEvent.click(trainingOption);

			expect(coach.level).toBe('training');
			expect(onchange).toHaveBeenCalledWith('training');
			// Dropdown should close
			expect(container.querySelector('.compact-dropdown')).not.toBeInTheDocument();
		});

		it('closes dropdown on click outside', async () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			// Open dropdown
			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);
			expect(container.querySelector('.compact-dropdown')).toBeInTheDocument();

			// Click outside (on document body, not inside the selector)
			await fireEvent.click(document.body);

			expect(container.querySelector('.compact-dropdown')).not.toBeInTheDocument();
		});

		it('has correct aria-expanded state', async () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			const trigger = container.querySelector('.compact-trigger')!;
			expect(trigger.getAttribute('aria-expanded')).toBe('false');

			await fireEvent.click(trigger);
			expect(trigger.getAttribute('aria-expanded')).toBe('true');
		});

		it('uses listbox role for dropdown', async () => {
			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);

			expect(container.querySelector('[role="listbox"]')).toBeInTheDocument();
		});

		it('shows checkmark on selected option', async () => {
			coach.__testing.setPreferences({
				level: 'hints',
				showProbabilities: true,
				highlightOptimal: true,
				showEVDelta: true,
				animateSuggestions: true,
			});

			const { container } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			const trigger = container.querySelector('.compact-trigger')!;
			await fireEvent.click(trigger);

			const selectedOption = container.querySelector('.dropdown-option.selected');
			expect(selectedOption?.querySelector('.option-check')).toBeInTheDocument();
		});
	});

	// ===========================================================================
	// Level Changes
	// ===========================================================================

	describe('level changes', () => {
		it.each([
			['off', 'Off'],
			['hints', 'Hints'],
			['coach', 'Coach'],
			['training', 'Training'],
		] as const)('can select %s level', async (level, label) => {
			const onchange = vi.fn();
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false, onchange }),
			});

			const button = getByText(label).closest('button');
			await fireEvent.click(button!);

			expect(coach.level).toBe(level);
			expect(onchange).toHaveBeenCalledWith(level);
		});

		it('persists level change to store', async () => {
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			const trainingButton = getByText('Training').closest('button');
			await fireEvent.click(trainingButton!);

			// Verify store was updated
			expect(coach.level).toBe('training');
			expect(coach.requiresConfirmation).toBe(true);
		});
	});

	// ===========================================================================
	// Icons
	// ===========================================================================

	describe('icons', () => {
		it('displays correct icons for each level in full mode', () => {
			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: false }),
			});

			expect(getByText(COACH_LEVEL_INFO.off.icon)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.hints.icon)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.coach.icon)).toBeInTheDocument();
			expect(getByText(COACH_LEVEL_INFO.training.icon)).toBeInTheDocument();
		});

		it('displays correct icon in compact trigger', () => {
			coach.__testing.setPreferences({
				level: 'training',
				showProbabilities: true,
				highlightOptimal: true,
				showEVDelta: true,
				animateSuggestions: true,
			});

			const { getByText } = render(CoachModeSelector, {
				props: createProps({ compact: true }),
			});

			expect(getByText(COACH_LEVEL_INFO.training.icon)).toBeInTheDocument();
		});
	});
});
