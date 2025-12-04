import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Profile } from '$lib/supabase/profiles';
import SetupModal from '../SetupModal.svelte';

// Mock Supabase client
vi.mock('$lib/supabase/client', () => ({
	createSupabaseBrowserClient: vi.fn(() => ({})),
}));

// Mock profiles API
vi.mock('$lib/supabase/profiles', async () => {
	const actual = await vi.importActual('$lib/supabase/profiles');
	return {
		...actual,
		updateProfile: vi.fn(),
	};
});

/**
 * Create mock profile for testing
 */
function createMockProfile(overrides: Partial<Profile> = {}): Profile {
	return {
		id: 'test-user-123',
		display_name: null,
		username: null,
		bio: null,
		avatar_seed: 'test-seed',
		avatar_style: 'identicon',
		is_anonymous: false,
		is_public: true,
		skill_rating: 1500,
		rating_deviation: 350,
		rating_volatility: 0.06,
		badges: [],
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		last_seen_at: new Date().toISOString(),
		...overrides,
	};
}

describe('SetupModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Visibility', () => {
		it('renders when open is true', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile, open: true } });

			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('does not render when open is false', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile, open: false } });

			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});

		it('defaults to open', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});
	});

	describe('New Profile State', () => {
		it('shows welcome message for new profiles', () => {
			const profile = createMockProfile({ display_name: null });
			render(SetupModal, { props: { profile } });

			expect(screen.getByText('Welcome to Dicee!')).toBeInTheDocument();
			expect(screen.getByText('Set up your profile to get started')).toBeInTheDocument();
		});

		it('shows update message for existing profiles', () => {
			const profile = createMockProfile({ display_name: 'Existing User' });
			render(SetupModal, { props: { profile } });

			expect(screen.getByText('Update Your Profile')).toBeInTheDocument();
			expect(screen.getByText('Keep your profile up to date')).toBeInTheDocument();
		});

		it('shows "Let\'s Go!" button for new profiles', () => {
			const profile = createMockProfile({ display_name: null });
			render(SetupModal, { props: { profile } });

			expect(screen.getByText("Let's Go!")).toBeInTheDocument();
		});

		it('shows "Save" button for existing profiles', () => {
			const profile = createMockProfile({ display_name: 'Existing User' });
			render(SetupModal, { props: { profile } });

			expect(screen.getByText('Save')).toBeInTheDocument();
		});
	});

	describe('Avatar Display', () => {
		it('displays avatar with user ID as seed', () => {
			const profile = createMockProfile({ id: 'unique-user-id' });
			const { container } = render(SetupModal, { props: { profile } });

			const avatar = container.querySelector('.avatar');
			expect(avatar).toBeInTheDocument();
		});

		it('shows avatar hint text', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByText('Your unique avatar')).toBeInTheDocument();
		});
	});

	describe('Form Fields', () => {
		it('renders display name input', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByLabelText(/Display Name/)).toBeInTheDocument();
		});

		it('renders bio textarea', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByLabelText(/Bio/)).toBeInTheDocument();
		});

		it('pre-fills display name from profile', () => {
			const profile = createMockProfile({ display_name: 'Test User' });
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/) as HTMLInputElement;
			expect(input.value).toBe('Test User');
		});

		it('pre-fills bio from profile', () => {
			const profile = createMockProfile({ bio: 'Test bio' });
			render(SetupModal, { props: { profile } });

			const textarea = screen.getByLabelText(/Bio/) as HTMLTextAreaElement;
			expect(textarea.value).toBe('Test bio');
		});

		it('shows character count for display name', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'Hello' } });

			expect(screen.getByText('5/50')).toBeInTheDocument();
		});

		it('shows character count for bio', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const textarea = screen.getByLabelText(/Bio/);
			await fireEvent.input(textarea, { target: { value: 'My bio text' } });

			expect(screen.getByText('11/500')).toBeInTheDocument();
		});
	});

	describe('Validation', () => {
		it('shows error for display name less than 2 characters', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'A' } });

			expect(screen.getByText('Must be 2-50 characters')).toBeInTheDocument();
		});

		it('disables submit when display name is invalid', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'A' } });

			const submitButton = screen.getByText("Let's Go!");
			expect(submitButton).toBeDisabled();
		});

		it('enables submit when display name is valid', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'Valid Name' } });

			const submitButton = screen.getByText("Let's Go!");
			expect(submitButton).not.toBeDisabled();
		});

		it('shows error for bio over 500 characters', async () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const textarea = screen.getByLabelText(/Bio/);
			await fireEvent.input(textarea, { target: { value: 'x'.repeat(501) } });

			expect(screen.getByText('Maximum 500 characters')).toBeInTheDocument();
		});
	});

	describe('Skip Button', () => {
		it('shows skip button when allowSkip is true', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile, allowSkip: true } });

			expect(screen.getByText('Skip for now')).toBeInTheDocument();
		});

		it('hides skip button when allowSkip is false', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile, allowSkip: false } });

			expect(screen.queryByText('Skip for now')).not.toBeInTheDocument();
		});

		it('calls onSkip when skip button is clicked', async () => {
			const profile = createMockProfile();
			const onSkip = vi.fn();
			render(SetupModal, { props: { profile, allowSkip: true, onSkip } });

			await fireEvent.click(screen.getByText('Skip for now'));

			expect(onSkip).toHaveBeenCalledOnce();
		});

		it('disables skip button when loading', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise(() => {
						/* Never resolves - simulates hanging async operation */
					}),
			);

			const profile = createMockProfile();
			render(SetupModal, { props: { profile, allowSkip: true } });

			// Fill valid name and submit
			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'Valid Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			expect(screen.getByText('Skip for now')).toBeDisabled();
		});
	});

	describe('Form Submission', () => {
		it('calls updateProfile on submit', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
				data: createMockProfile({ display_name: 'New Name' }),
				error: null,
			});

			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			await waitFor(() => {
				expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'test-user-123', {
					display_name: 'New Name',
					bio: null,
				});
			});
		});

		it('calls onComplete with updated profile on success', async () => {
			const updatedProfile = createMockProfile({ display_name: 'New Name' });
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
				data: updatedProfile,
				error: null,
			});

			const profile = createMockProfile();
			const onComplete = vi.fn();
			render(SetupModal, { props: { profile, onComplete } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			await waitFor(() => {
				expect(onComplete).toHaveBeenCalledWith(updatedProfile);
			});
		});

		it('shows loading state during submission', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise(() => {
						/* Never resolves - simulates hanging async operation */
					}),
			);

			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			expect(screen.getByText('Saving...')).toBeInTheDocument();
		});

		it('disables form inputs during submission', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise(() => {
						/* Never resolves - simulates hanging async operation */
					}),
			);

			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			expect(input).toBeDisabled();
			expect(screen.getByLabelText(/Bio/)).toBeDisabled();
		});

		it('shows error message on failure', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
				data: null,
				error: new Error('Network error'),
			});

			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			await waitFor(() => {
				expect(screen.getByText('Network error')).toBeInTheDocument();
			});
		});
	});

	describe('Keyboard Navigation', () => {
		it('closes on Escape when allowSkip is true', async () => {
			const profile = createMockProfile();
			const onClose = vi.fn();
			render(SetupModal, { props: { profile, allowSkip: true, onClose } });

			await fireEvent.keyDown(window, { key: 'Escape' });

			expect(onClose).toHaveBeenCalledOnce();
		});

		it('does not close on Escape when allowSkip is false', async () => {
			const profile = createMockProfile();
			const onClose = vi.fn();
			render(SetupModal, { props: { profile, allowSkip: false, onClose } });

			await fireEvent.keyDown(window, { key: 'Escape' });

			expect(onClose).not.toHaveBeenCalled();
		});
	});

	describe('Accessibility', () => {
		it('has dialog role', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('has aria-modal attribute', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
		});

		it('has aria-labelledby pointing to title', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const dialog = screen.getByRole('dialog');
			expect(dialog).toHaveAttribute('aria-labelledby', 'setup-title');
			expect(screen.getByText('Welcome to Dicee!')).toHaveAttribute('id', 'setup-title');
		});

		it('marks display name as required', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			expect(input).toHaveAttribute('required');
		});

		it('uses role="alert" for error messages', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			(updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
				data: null,
				error: new Error('Failed'),
			});

			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			const input = screen.getByLabelText(/Display Name/);
			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.click(screen.getByText("Let's Go!"));

			await waitFor(() => {
				expect(screen.getByRole('alert')).toBeInTheDocument();
			});
		});
	});

	describe('Privacy Note', () => {
		it('shows privacy note about display name visibility', () => {
			const profile = createMockProfile();
			render(SetupModal, { props: { profile } });

			expect(
				screen.getByText('Your display name will be visible to other players.'),
			).toBeInTheDocument();
		});
	});
});
