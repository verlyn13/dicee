/**
 * AuthStatus Component Tests
 *
 * Tests for the auth status display component.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AuthStatus from '../AuthStatus.svelte';

// Create a mock auth state that can be controlled
const createMockAuth = (overrides = {}) => ({
	isAuthenticated: false,
	isAnonymous: false,
	user: null,
	email: null,
	loading: false,
	signOut: vi.fn().mockResolvedValue(undefined),
	...overrides,
});

let mockAuth = createMockAuth();

vi.mock('$lib/stores/auth.svelte', () => ({
	get auth() {
		return mockAuth;
	},
}));

describe('AuthStatus', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAuth = createMockAuth();
	});

	it('does not render when not authenticated', () => {
		mockAuth = createMockAuth({ isAuthenticated: false });
		const { container } = render(AuthStatus);

		expect(container.querySelector('.auth-status')).not.toBeInTheDocument();
	});

	it('renders when authenticated', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
		});
		render(AuthStatus);

		expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
	});

	it('shows Guest badge for anonymous users', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: true,
			user: { id: '123', is_anonymous: true },
		});
		render(AuthStatus);

		expect(screen.getByText('Guest')).toBeInTheDocument();
	});

	it('shows email prefix for authenticated users', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: false,
			user: { id: '123', email: 'john@example.com' },
			email: 'john@example.com',
		});
		render(AuthStatus);

		expect(screen.getByText('john')).toBeInTheDocument();
	});

	it('shows "User" fallback when no email', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: false,
			user: { id: '123' },
			email: null,
		});
		render(AuthStatus);

		expect(screen.getByText('User')).toBeInTheDocument();
	});
});

describe('AuthStatus: Sign Out', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls signOut on button click', async () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
		});
		render(AuthStatus);

		const button = screen.getByRole('button', { name: 'Sign Out' });
		await fireEvent.click(button);

		expect(mockAuth.signOut).toHaveBeenCalledOnce();
	});

	it('shows loading state during sign out', async () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
			signOut: vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					}),
			),
		});
		render(AuthStatus);

		const button = screen.getByRole('button', { name: 'Sign Out' });
		fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByRole('button')).toHaveTextContent('...');
			expect(screen.getByRole('button')).toBeDisabled();
			expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
		});
	});

	it('handles sign out error gracefully', async () => {
		// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to silence console.error
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
			signOut: vi.fn().mockRejectedValue(new Error('Network error')),
		});
		render(AuthStatus);

		const button = screen.getByRole('button', { name: 'Sign Out' });
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalled();
		});

		// Button should recover from loading state
		expect(screen.getByRole('button', { name: 'Sign Out' })).not.toBeDisabled();

		consoleError.mockRestore();
	});
});

describe('AuthStatus: Styling', () => {
	beforeEach(() => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
		});
	});

	it('applies custom class', () => {
		const { container } = render(AuthStatus, { props: { class: 'header-auth' } });

		const status = container.querySelector('.auth-status');
		expect(status).toHaveClass('header-auth');
	});

	it('guest badge has appropriate styling class', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: true,
			user: { id: '123', is_anonymous: true },
		});
		const { container } = render(AuthStatus);

		expect(container.querySelector('.guest-badge')).toBeInTheDocument();
	});

	it('user name has appropriate styling class', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: false,
			user: { id: '123', email: 'test@example.com' },
			email: 'test@example.com',
		});
		const { container } = render(AuthStatus);

		expect(container.querySelector('.user-name')).toBeInTheDocument();
	});
});

describe('AuthStatus: Accessibility', () => {
	beforeEach(() => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			user: { id: '123' },
		});
	});

	it('has no accessibility violations', async () => {
		const { container } = render(AuthStatus);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('sign out button is keyboard accessible', () => {
		render(AuthStatus);

		const button = screen.getByRole('button', { name: 'Sign Out' });
		button.focus();
		expect(document.activeElement).toBe(button);
	});

	it('aria-busy is false when not signing out', () => {
		render(AuthStatus);

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('aria-busy', 'false');
	});
});

describe('AuthStatus: Display Name Derivation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('extracts username from email correctly', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: false,
			user: { id: '123', email: 'jane.doe@company.org' },
			email: 'jane.doe@company.org',
		});
		render(AuthStatus);

		expect(screen.getByText('jane.doe')).toBeInTheDocument();
	});

	it('handles email with multiple @ symbols', () => {
		mockAuth = createMockAuth({
			isAuthenticated: true,
			isAnonymous: false,
			user: { id: '123', email: 'weird@@example.com' },
			email: 'weird@@example.com',
		});
		render(AuthStatus);

		// split('@')[0] would return 'weird'
		expect(screen.getByText('weird')).toBeInTheDocument();
	});
});
