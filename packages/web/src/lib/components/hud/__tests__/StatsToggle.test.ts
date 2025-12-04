/**
 * StatsToggle Component Tests
 * Tests toggle functionality, profile selector, and accessibility
 */

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { StatsProfile } from '$lib/types.js';
import StatsToggle from '../StatsToggle.svelte';

// =============================================================================
// Test Fixtures
// =============================================================================

const defaultProps = {
	enabled: false,
	profile: 'intermediate' as StatsProfile,
	onToggle: vi.fn(),
	onProfileChange: vi.fn(),
};

function createProps(overrides: Partial<typeof defaultProps> = {}) {
	return {
		...defaultProps,
		onToggle: vi.fn(),
		onProfileChange: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// Rendering Tests
// =============================================================================

describe('StatsToggle Component - Rendering', () => {
	it('renders toggle button', () => {
		const { container } = render(StatsToggle, { props: createProps() });

		expect(container.querySelector('.stats-toggle')).toBeInTheDocument();
	});

	it('shows OFF label when disabled', () => {
		const { getByText } = render(StatsToggle, {
			props: createProps({ enabled: false }),
		});

		expect(getByText(/Stats: OFF/)).toBeInTheDocument();
	});

	it('shows ON label when enabled', () => {
		const { getByText } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		expect(getByText(/Stats: ON/)).toBeInTheDocument();
	});

	it('applies enabled class when enabled', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		expect(container.querySelector('.stats-toggle')).toHaveClass('enabled');
	});

	it('does not apply enabled class when disabled', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: false }),
		});

		expect(container.querySelector('.stats-toggle')).not.toHaveClass('enabled');
	});

	it('renders toggle track and thumb', () => {
		const { container } = render(StatsToggle, { props: createProps() });

		expect(container.querySelector('.toggle-track')).toBeInTheDocument();
		expect(container.querySelector('.toggle-thumb')).toBeInTheDocument();
	});
});

// =============================================================================
// Profile Selector Tests
// =============================================================================

describe('StatsToggle Component - Profile Selector', () => {
	it('hides profile selector when disabled', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: false }),
		});

		expect(container.querySelector('.profile-selector')).not.toBeInTheDocument();
	});

	it('shows profile selector when enabled', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		expect(container.querySelector('.profile-selector')).toBeInTheDocument();
	});

	it('shows current profile in button', () => {
		const { getByText } = render(StatsToggle, {
			props: createProps({ enabled: true, profile: 'beginner' }),
		});

		expect(getByText('beginner')).toBeInTheDocument();
	});

	it('dropdown is initially closed', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		expect(container.querySelector('.profile-dropdown')).not.toBeInTheDocument();
	});

	it('opens dropdown on profile button click', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		expect(container.querySelector('.profile-dropdown')).toBeInTheDocument();
	});

	it('closes dropdown on second click', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);
		await fireEvent.click(profileButton);

		expect(container.querySelector('.profile-dropdown')).not.toBeInTheDocument();
	});

	it('shows all three profile options in dropdown', async () => {
		const { container, getByText } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		expect(getByText('Beginner')).toBeInTheDocument();
		expect(getByText('Intermediate')).toBeInTheDocument();
		expect(getByText('Expert')).toBeInTheDocument();
	});

	it('shows descriptions for each profile', async () => {
		const { container, getByText } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		expect(getByText('Simple guidance without numbers')).toBeInTheDocument();
		expect(getByText('Probabilities and expected values')).toBeInTheDocument();
		expect(getByText('Full analysis tools')).toBeInTheDocument();
	});

	it('marks current profile as selected', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true, profile: 'expert' }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		const options = container.querySelectorAll('.profile-option');
		const expertOption = Array.from(options).find((opt) => opt.textContent?.includes('Expert'));
		expect(expertOption).toHaveClass('selected');
	});
});

// =============================================================================
// Interaction Tests
// =============================================================================

describe('StatsToggle Component - Interactions', () => {
	it('calls onToggle when toggle button clicked', async () => {
		const props = createProps();
		const { container } = render(StatsToggle, { props });

		const toggle = container.querySelector('.stats-toggle')!;
		await fireEvent.click(toggle);

		expect(props.onToggle).toHaveBeenCalledTimes(1);
	});

	it('calls onProfileChange when profile option selected', async () => {
		const props = createProps({ enabled: true, profile: 'beginner' });
		const { container } = render(StatsToggle, { props });

		// Open dropdown
		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		// Click expert option
		const options = container.querySelectorAll('.profile-option');
		const expertOption = Array.from(options).find((opt) => opt.textContent?.includes('Expert'))!;
		await fireEvent.click(expertOption);

		expect(props.onProfileChange).toHaveBeenCalledWith('expert');
	});

	it('closes dropdown after selecting profile', async () => {
		const props = createProps({ enabled: true });
		const { container } = render(StatsToggle, { props });

		// Open dropdown
		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		// Click an option
		const options = container.querySelectorAll('.profile-option');
		await fireEvent.click(options[0]);

		// Dropdown should close
		expect(container.querySelector('.profile-dropdown')).not.toBeInTheDocument();
	});

	it('calls onProfileChange with correct profile values', async () => {
		const profiles = ['beginner', 'intermediate', 'expert'] as const;

		for (const profile of profiles) {
			const props = createProps({ enabled: true, profile: 'beginner' });
			const { container } = render(StatsToggle, { props });

			const profileButton = container.querySelector('.profile-button')!;
			await fireEvent.click(profileButton);

			const options = container.querySelectorAll('.profile-option');
			const targetOption = Array.from(options).find((opt) =>
				opt.querySelector('.option-label')?.textContent?.toLowerCase().includes(profile),
			)!;
			await fireEvent.click(targetOption);

			expect(props.onProfileChange).toHaveBeenCalledWith(profile);
		}
	});
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('StatsToggle Component - Accessibility', () => {
	it('passes axe audit when disabled', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: false }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit when enabled', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('passes axe audit with dropdown open', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('toggle has aria-pressed attribute', () => {
		const { container, rerender } = render(StatsToggle, {
			props: createProps({ enabled: false }),
		});

		expect(container.querySelector('.stats-toggle')).toHaveAttribute('aria-pressed', 'false');

		rerender(createProps({ enabled: true }));
		expect(container.querySelector('.stats-toggle')).toHaveAttribute('aria-pressed', 'true');
	});

	it('toggle has aria-label', () => {
		const { container } = render(StatsToggle, { props: createProps() });

		const toggle = container.querySelector('.stats-toggle');
		expect(toggle).toHaveAttribute('aria-label', 'Toggle statistics display');
	});

	it('profile button has aria-expanded attribute', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button');
		expect(profileButton).toHaveAttribute('aria-expanded', 'false');

		await fireEvent.click(profileButton!);
		expect(profileButton).toHaveAttribute('aria-expanded', 'true');
	});

	it('profile button has aria-haspopup attribute', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button');
		expect(profileButton).toHaveAttribute('aria-haspopup', 'menu');
	});

	it('dropdown has role="menu"', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		const dropdown = container.querySelector('.profile-dropdown');
		expect(dropdown).toHaveAttribute('role', 'menu');
	});

	it('options have role="menuitem"', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		const options = container.querySelectorAll('.profile-option');
		for (const option of options) {
			expect(option).toHaveAttribute('role', 'menuitem');
		}
	});

	it('selected option has aria-current="true"', async () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true, profile: 'intermediate' }),
		});

		const profileButton = container.querySelector('.profile-button')!;
		await fireEvent.click(profileButton);

		const options = container.querySelectorAll('.profile-option');
		const intermediateOption = Array.from(options).find((opt) =>
			opt.textContent?.includes('Intermediate'),
		);

		expect(intermediateOption).toHaveAttribute('aria-current', 'true');
	});

	it('all interactive elements are buttons', () => {
		const { container } = render(StatsToggle, {
			props: createProps({ enabled: true }),
		});

		expect(container.querySelector('.stats-toggle')?.tagName).toBe('BUTTON');
		expect(container.querySelector('.profile-button')?.tagName).toBe('BUTTON');
	});
});
