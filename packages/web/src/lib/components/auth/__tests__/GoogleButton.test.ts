/**
 * GoogleButton Component Tests
 *
 * Tests for the Google OAuth sign-in button component.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import GoogleButton from '../GoogleButton.svelte';

// Mock the auth store
vi.mock('$lib/stores/auth.svelte', () => ({
	auth: {
		signInWithGoogle: vi.fn().mockResolvedValue(undefined),
		linkGoogle: vi.fn().mockResolvedValue(undefined),
		isAnonymous: false,
	},
}));

describe('GoogleButton', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders sign-in text by default', () => {
		render(GoogleButton);

		expect(screen.getByText('Continue with Google')).toBeInTheDocument();
	});

	it('renders link text when mode is link', () => {
		render(GoogleButton, { props: { mode: 'link' } });

		expect(screen.getByText('Link Google Account')).toBeInTheDocument();
	});

	it('has Google icon', () => {
		render(GoogleButton);

		// SVG should be present with aria-hidden
		const button = screen.getByRole('button');
		const svg = button.querySelector('svg');
		expect(svg).toBeInTheDocument();
		expect(svg).toHaveAttribute('aria-hidden', 'true');
	});

	it('calls signInWithGoogle on click (signin mode)', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		render(GoogleButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(auth.signInWithGoogle).toHaveBeenCalledOnce();
	});

	it('calls linkGoogle on click (link mode)', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		render(GoogleButton, { props: { mode: 'link' } });

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(auth.linkGoogle).toHaveBeenCalledOnce();
	});

	it('passes redirectTo to auth methods', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		render(GoogleButton, { props: { redirectTo: '/game' } });

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(auth.signInWithGoogle).toHaveBeenCalledWith('/game');
	});

	it('shows loading state during redirect', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		// Make the call hang
		let resolveAuth: (value?: unknown) => void;
		(auth.signInWithGoogle as ReturnType<typeof vi.fn>).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveAuth = resolve;
				}),
		);

		render(GoogleButton);

		const button = screen.getByRole('button');
		fireEvent.click(button);

		// Should show loading text
		await vi.waitFor(() => {
			expect(screen.getByText('Redirecting...')).toBeInTheDocument();
		});

		resolveAuth!();
	});

	it('is disabled during loading', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');

		let resolveAuth: (value?: unknown) => void;
		(auth.signInWithGoogle as ReturnType<typeof vi.fn>).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveAuth = resolve;
				}),
		);

		render(GoogleButton);

		const button = screen.getByRole('button');
		fireEvent.click(button);

		await vi.waitFor(() => {
			expect(button).toBeDisabled();
		});

		resolveAuth!();
	});

	it('displays error on failure', async () => {
		const { auth } = await import('$lib/stores/auth.svelte');
		(auth.signInWithGoogle as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('OAuth failed'),
		);

		render(GoogleButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('OAuth failed');
		});
	});

	it('applies custom class', () => {
		render(GoogleButton, { props: { class: 'my-custom-class' } });

		const button = screen.getByRole('button');
		expect(button).toHaveClass('my-custom-class');
	});
});

describe('GoogleButton: Accessibility', () => {
	it('has no accessibility violations', async () => {
		const { container } = render(GoogleButton);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('is keyboard accessible', () => {
		render(GoogleButton);

		const button = screen.getByRole('button');
		button.focus();
		expect(document.activeElement).toBe(button);
	});
});
