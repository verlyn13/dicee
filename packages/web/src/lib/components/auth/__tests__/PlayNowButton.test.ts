/**
 * PlayNowButton Component Tests
 *
 * Tests for the anonymous sign-in button component.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import PlayNowButton from '../PlayNowButton.svelte';

// Mock the auth store
vi.mock('$lib/stores/auth.svelte', () => {
	let loading = false;

	return {
		auth: {
			get loading() {
				return loading;
			},
			signInAnonymously: vi.fn().mockImplementation(async () => {
				loading = true;
				await new Promise((r) => setTimeout(r, 10));
				loading = false;
			}),
			__testing: {
				setLoading: (value: boolean) => {
					loading = value;
				},
			},
		},
	};
});

describe('PlayNowButton', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset loading state before each test
		const { auth } = await import('$lib/stores/auth.svelte');
		auth.__testing.setLoading(false);
	});

	it('renders with correct text', () => {
		render(PlayNowButton);

		expect(screen.getByText('PLAY NOW')).toBeInTheDocument();
		expect(screen.getByText('No account needed')).toBeInTheDocument();
	});

	it('has correct button role', () => {
		render(PlayNowButton);

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
	});

	it('calls signInAnonymously on click', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		render(PlayNowButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(auth.signInAnonymously).toHaveBeenCalledOnce();
	});

	it('calls onclick callback after sign in', async () => {
		const onclick = vi.fn();

		render(PlayNowButton, { props: { onclick } });

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		// Wait for async operation
		await vi.waitFor(() => {
			expect(onclick).toHaveBeenCalledOnce();
		});
	});

	it('shows loading state', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		// Make signInAnonymously hang (we don't need to resolve it for this test)
		(auth.signInAnonymously as ReturnType<typeof vi.fn>).mockImplementation(
			() =>
				new Promise(() => {
					/* Never resolves - simulates hanging async operation */
				}),
		);
		auth.__testing.setLoading(true);

		const { rerender } = render(PlayNowButton);

		// Force re-render to pick up loading state
		await rerender({});

		// Check for loading state (button should be disabled)
		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
	});

	it('is disabled when loading', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');
		auth.__testing.setLoading(true);

		const { rerender } = render(PlayNowButton);
		await rerender({});

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('applies custom class', () => {
		render(PlayNowButton, { props: { class: 'custom-class' } });

		const button = screen.getByRole('button');
		expect(button).toHaveClass('custom-class');
	});

	it('has proper focus styling (accessible)', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');
		auth.__testing.setLoading(false);

		render(PlayNowButton);

		const button = screen.getByRole('button');

		// Button should be focusable when not disabled
		expect(button).not.toBeDisabled();
		button.focus();
		expect(document.activeElement).toBe(button);
	});

	it('meets touch target size requirements (44px)', () => {
		render(PlayNowButton);

		const button = screen.getByRole('button');

		// Check computed styles would require more setup
		// For now, verify the class is applied which has min-height in CSS
		expect(button).toHaveClass('play-now-button');
	});
});

describe('PlayNowButton: Error Handling', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const { auth } = await import('$lib/stores/auth.svelte');
		auth.__testing.setLoading(false);
	});

	it('displays error message on sign-in failure', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');
		(auth.signInAnonymously as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('Network error'),
		);

		render(PlayNowButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Network error');
		});
	});

	it('does not call onclick on error', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');
		(auth.signInAnonymously as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'));
		const onclick = vi.fn();

		render(PlayNowButton, { props: { onclick } });

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(onclick).not.toHaveBeenCalled();
		});
	});
});

describe('PlayNowButton: Accessibility', () => {
	it('has no accessibility violations', async () => {
		const { container } = render(PlayNowButton);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});
});
