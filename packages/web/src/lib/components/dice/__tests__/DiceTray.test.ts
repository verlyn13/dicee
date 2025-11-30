/**
 * DiceTray Component Tests
 * Tests rendering, interactions, and game state integration
 */

import type { DiceArray, KeptMask } from '$lib/types.js';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import DiceTray from '../DiceTray.svelte';

// =============================================================================
// Test Fixtures
// =============================================================================

const defaultProps = {
	dice: [1, 2, 3, 4, 5] as DiceArray,
	kept: [false, false, false, false, false] as KeptMask,
	rollsRemaining: 3,
	canRoll: true,
	canKeep: true,
	rolling: false,
	onRoll: vi.fn(),
	onToggleKeep: vi.fn(),
	onKeepAll: vi.fn(),
	onReleaseAll: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onRoll: vi.fn(),
		onToggleKeep: vi.fn(),
		onKeepAll: vi.fn(),
		onReleaseAll: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// Rendering Tests
// =============================================================================

describe('DiceTray Component - Rendering', () => {
	it('renders 5 dice', () => {
		const { container } = render(DiceTray, { props: createProps() });

		const dice = container.querySelectorAll('.die');
		expect(dice).toHaveLength(5);
	});

	it('renders dice with correct values', () => {
		const props = createProps({ dice: [6, 5, 4, 3, 2] as DiceArray });
		const { container } = render(DiceTray, { props });

		const faces = container.querySelectorAll('.face');
		expect(faces[0]).toHaveAttribute('data-value', '6');
		expect(faces[1]).toHaveAttribute('data-value', '5');
		expect(faces[2]).toHaveAttribute('data-value', '4');
		expect(faces[3]).toHaveAttribute('data-value', '3');
		expect(faces[4]).toHaveAttribute('data-value', '2');
	});

	it('renders dice with correct kept states', () => {
		const props = createProps({
			kept: [true, false, true, false, true] as KeptMask,
		});
		const { container } = render(DiceTray, { props });

		const dice = container.querySelectorAll('.die');
		expect(dice[0]).toHaveClass('kept');
		expect(dice[1]).not.toHaveClass('kept');
		expect(dice[2]).toHaveClass('kept');
		expect(dice[3]).not.toHaveClass('kept');
		expect(dice[4]).toHaveClass('kept');
	});

	it('renders roll button', () => {
		const { getByRole } = render(DiceTray, { props: createProps() });

		expect(getByRole('button', { name: /roll/i })).toBeInTheDocument();
	});

	it('renders roll counter with 3 pips', () => {
		const { container } = render(DiceTray, { props: createProps() });

		const pips = container.querySelectorAll('.counter-pip');
		expect(pips).toHaveLength(3);
	});
});

// =============================================================================
// Roll Button State Tests
// =============================================================================

describe('DiceTray Component - Roll Button States', () => {
	it('shows "ROLL DICE" on first roll', () => {
		const props = createProps({ rollsRemaining: 3 });
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /roll dice/i })).toBeInTheDocument();
	});

	it('shows "REROLL (2)" with 2 rolls remaining', () => {
		const props = createProps({ rollsRemaining: 2 });
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /reroll \(2\)/i })).toBeInTheDocument();
	});

	it('shows "REROLL (1)" with 1 roll remaining', () => {
		const props = createProps({ rollsRemaining: 1 });
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /reroll \(1\)/i })).toBeInTheDocument();
	});

	it('shows "NO ROLLS LEFT" with 0 rolls remaining', () => {
		const props = createProps({ rollsRemaining: 0 });
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /no rolls left/i })).toBeInTheDocument();
	});

	it('shows "ROLLING..." while rolling', () => {
		const props = createProps({ rolling: true });
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /rolling/i })).toBeInTheDocument();
	});

	it('disables roll button when canRoll is false', () => {
		const props = createProps({ canRoll: false });
		const { container } = render(DiceTray, { props });

		const button = container.querySelector('.roll-btn');
		expect(button).toBeDisabled();
	});

	it('enables roll button when canRoll is true', () => {
		const props = createProps({ canRoll: true });
		const { container } = render(DiceTray, { props });

		const button = container.querySelector('.roll-btn');
		expect(button).not.toBeDisabled();
	});
});

// =============================================================================
// Quick Actions Tests
// =============================================================================

describe('DiceTray Component - Quick Actions', () => {
	it('hides quick actions on first roll', () => {
		const props = createProps({ rollsRemaining: 3, canKeep: true });
		const { container } = render(DiceTray, { props });

		expect(container.querySelector('.quick-actions')).not.toBeInTheDocument();
	});

	it('shows quick actions after first roll when canKeep', () => {
		const props = createProps({ rollsRemaining: 2, canKeep: true });
		const { container } = render(DiceTray, { props });

		expect(container.querySelector('.quick-actions')).toBeInTheDocument();
	});

	it('hides quick actions when canKeep is false', () => {
		const props = createProps({ rollsRemaining: 2, canKeep: false });
		const { container } = render(DiceTray, { props });

		expect(container.querySelector('.quick-actions')).not.toBeInTheDocument();
	});

	it('disables Keep All when all dice kept', () => {
		const props = createProps({
			rollsRemaining: 2,
			canKeep: true,
			kept: [true, true, true, true, true] as KeptMask,
		});
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /keep all/i })).toBeDisabled();
	});

	it('enables Keep All when some dice not kept', () => {
		const props = createProps({
			rollsRemaining: 2,
			canKeep: true,
			kept: [true, false, true, false, true] as KeptMask,
		});
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /keep all/i })).not.toBeDisabled();
	});

	it('disables Release All when no dice kept', () => {
		const props = createProps({
			rollsRemaining: 2,
			canKeep: true,
			kept: [false, false, false, false, false] as KeptMask,
		});
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /release all/i })).toBeDisabled();
	});

	it('enables Release All when some dice kept', () => {
		const props = createProps({
			rollsRemaining: 2,
			canKeep: true,
			kept: [true, false, true, false, true] as KeptMask,
		});
		const { getByRole } = render(DiceTray, { props });

		expect(getByRole('button', { name: /release all/i })).not.toBeDisabled();
	});
});

// =============================================================================
// Roll Counter Tests
// =============================================================================

describe('DiceTray Component - Roll Counter', () => {
	it('shows all pips available with 3 rolls remaining', () => {
		const props = createProps({ rollsRemaining: 3 });
		const { container } = render(DiceTray, { props });

		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(0);
	});

	it('shows 1 pip used with 2 rolls remaining', () => {
		const props = createProps({ rollsRemaining: 2 });
		const { container } = render(DiceTray, { props });

		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(1);
	});

	it('shows 2 pips used with 1 roll remaining', () => {
		const props = createProps({ rollsRemaining: 1 });
		const { container } = render(DiceTray, { props });

		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(2);
	});

	it('shows all pips used with 0 rolls remaining', () => {
		const props = createProps({ rollsRemaining: 0 });
		const { container } = render(DiceTray, { props });

		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(3);
	});

	it('has aria-live region for screen reader announcements', () => {
		const { container } = render(DiceTray, { props: createProps() });

		const counter = container.querySelector('.roll-counter');
		expect(counter).toHaveAttribute('aria-live', 'polite');
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('DiceTray Component - Interactions', () => {
	it('calls onRoll when roll button clicked', async () => {
		const props = createProps();
		const { container } = render(DiceTray, { props });

		const button = container.querySelector('.roll-btn')!;
		await fireEvent.click(button);

		expect(props.onRoll).toHaveBeenCalledTimes(1);
	});

	it('roll button is disabled when canRoll is false', () => {
		const props = createProps({ canRoll: false });
		const { container } = render(DiceTray, { props });

		const button = container.querySelector('.roll-btn');
		expect(button).toBeDisabled();
	});

	it('calls onToggleKeep with index when die clicked', async () => {
		const props = createProps({ rollsRemaining: 2 });
		const { container } = render(DiceTray, { props });

		const dice = container.querySelectorAll('.die');
		await fireEvent.click(dice[2]);

		expect(props.onToggleKeep).toHaveBeenCalledWith(2);
	});

	it('calls onToggleKeep for each die with correct index', async () => {
		const props = createProps({ rollsRemaining: 2 });
		const { container } = render(DiceTray, { props });

		const dice = container.querySelectorAll('.die');
		for (let i = 0; i < 5; i++) {
			await fireEvent.click(dice[i]);
			expect(props.onToggleKeep).toHaveBeenCalledWith(i);
		}
	});

	it('does not call onToggleKeep when canKeep is false', async () => {
		const props = createProps({ canKeep: false });
		const { container } = render(DiceTray, { props });

		const dice = container.querySelectorAll('.die');
		await fireEvent.click(dice[0]);

		expect(props.onToggleKeep).not.toHaveBeenCalled();
	});

	it('calls onKeepAll when Keep All clicked', async () => {
		const props = createProps({ rollsRemaining: 2, canKeep: true });
		const { getByRole } = render(DiceTray, { props });

		const button = getByRole('button', { name: /keep all/i });
		await fireEvent.click(button);

		expect(props.onKeepAll).toHaveBeenCalledTimes(1);
	});

	it('calls onReleaseAll when Release All clicked', async () => {
		const props = createProps({
			rollsRemaining: 2,
			canKeep: true,
			kept: [true, true, true, true, true] as KeptMask,
		});
		const { getByRole } = render(DiceTray, { props });

		const button = getByRole('button', { name: /release all/i });
		await fireEvent.click(button);

		expect(props.onReleaseAll).toHaveBeenCalledTimes(1);
	});
});

// =============================================================================
// Rolling State Tests
// =============================================================================

describe('DiceTray Component - Rolling State', () => {
	it('applies rolling state to dice', () => {
		const props = createProps({ rolling: true });
		const { container } = render(DiceTray, { props });

		const dice = container.querySelectorAll('.die');
		for (const die of dice) {
			expect(die).toHaveClass('rolling');
		}
	});

	it('sets data-rolling attribute on tray', () => {
		const props = createProps({ rolling: true });
		const { container } = render(DiceTray, { props });

		const tray = container.querySelector('.dice-tray');
		expect(tray).toHaveAttribute('data-rolling', 'true');
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('DiceTray Component - Accessibility', () => {
	it('passes axe audit', async () => {
		const { container } = render(DiceTray, { props: createProps() });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit with quick actions visible', async () => {
		const props = createProps({ rollsRemaining: 2, canKeep: true });
		const { container } = render(DiceTray, { props });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('all dice are keyboard accessible', () => {
		const { container } = render(DiceTray, { props: createProps() });

		const dice = container.querySelectorAll('.die');
		for (const die of dice) {
			expect(die.tagName).toBe('BUTTON');
		}
	});

	it('roll counter pips container has accessible label', () => {
		const props = createProps({ rollsRemaining: 2 });
		const { container } = render(DiceTray, { props });

		const pipsContainer = container.querySelector('.counter-pips');
		expect(pipsContainer).toHaveAttribute('role', 'img');
		expect(pipsContainer).toHaveAttribute('aria-label', '2 rolls remaining');
	});
});

// =============================================================================
// Game Flow Integration Tests
// =============================================================================

describe('DiceTray Component - Game Flow', () => {
	it('simulates first roll scenario', async () => {
		const props = createProps({
			dice: [0, 0, 0, 0, 0] as unknown as DiceArray,
			rollsRemaining: 3,
			canRoll: true,
			canKeep: false,
		});
		const { container, getByRole } = render(DiceTray, { props });

		// First roll - no dice kept, quick actions hidden
		expect(container.querySelector('.quick-actions')).not.toBeInTheDocument();

		// Roll button shows "ROLL DICE"
		expect(getByRole('button', { name: /roll dice/i })).toBeInTheDocument();
	});

	it('simulates mid-turn scenario', async () => {
		const props = createProps({
			dice: [6, 3, 6, 2, 1] as DiceArray,
			kept: [true, false, true, false, false] as KeptMask,
			rollsRemaining: 1,
			canRoll: true,
			canKeep: true,
		});
		const { container, getByRole } = render(DiceTray, { props });

		// 2 dice kept
		const keptDice = container.querySelectorAll('.die.kept');
		expect(keptDice).toHaveLength(2);

		// Quick actions visible
		expect(container.querySelector('.quick-actions')).toBeInTheDocument();

		// Reroll button shows remaining rolls
		expect(getByRole('button', { name: /reroll \(1\)/i })).toBeInTheDocument();

		// 2 pips used
		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(2);
	});

	it('simulates final state scenario', async () => {
		const props = createProps({
			dice: [6, 6, 6, 1, 2] as DiceArray,
			kept: [true, true, true, false, false] as KeptMask,
			rollsRemaining: 0,
			canRoll: false,
			canKeep: false,
		});
		const { container, getByRole } = render(DiceTray, { props });

		// Roll button disabled
		expect(getByRole('button', { name: /no rolls left/i })).toBeDisabled();

		// All pips used
		const usedPips = container.querySelectorAll('.counter-pip.used');
		expect(usedPips).toHaveLength(3);

		// Quick actions hidden (canKeep false)
		expect(container.querySelector('.quick-actions')).not.toBeInTheDocument();
	});
});
