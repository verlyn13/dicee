import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '$lib/supabase/profiles';
import ProfileForm from '../ProfileForm.svelte';

// Mock Supabase client
vi.mock('$lib/supabase/client', () => ({
	createSupabaseBrowserClient: vi.fn(() => ({
		from: vi.fn(),
	})),
}));

// Mock profiles API
vi.mock('$lib/supabase/profiles', async () => {
	const actual = await vi.importActual('$lib/supabase/profiles');
	return {
		...actual,
		updateProfile: vi.fn(),
	};
});

// Mock DiceBear to prevent SVG generation in tests
vi.mock('@dicebear/core', () => ({
	createAvatar: vi.fn(() => ({
		toString: () => '<svg></svg>',
	})),
}));

vi.mock('@dicebear/collection', () => ({
	identicon: {},
}));

describe('ProfileForm', () => {
	const mockProfile: Profile = {
		id: 'user-123',
		display_name: 'Test User',
		bio: 'Test bio',
		avatar_seed: 'user-123',
		avatar_style: 'identicon',
		skill_rating: 1500.0,
		rating_deviation: 350.0,
		rating_volatility: 0.06,
		badges: [],
		is_anonymous: false,
		is_public: true,
		username: null,
		preferences: null,
		role: 'user',
		created_at: '2025-01-01T00:00:00Z',
		updated_at: '2025-01-01T00:00:00Z',
		last_seen_at: '2025-01-01T00:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Rendering', () => {
		it('renders form with profile data', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const displayNameInput = container.querySelector('#display-name') as HTMLInputElement;
			const bioTextarea = container.querySelector('#bio') as HTMLTextAreaElement;

			expect(displayNameInput).toBeTruthy();
			expect(displayNameInput.value).toBe('Test User');
			expect(bioTextarea).toBeTruthy();
			expect(bioTextarea.value).toBe('Test bio');
		});

		it('renders with empty bio when null', () => {
			const profileWithoutBio = { ...mockProfile, bio: null };
			const { container } = render(ProfileForm, { props: { profile: profileWithoutBio } });

			const bioTextarea = container.querySelector('#bio') as HTMLTextAreaElement;
			expect(bioTextarea.value).toBe('');
		});

		it('shows character counts', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const hints = container.querySelectorAll('.char-count');
			expect(hints.length).toBeGreaterThan(0);
		});

		it('shows avatar preview section', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const avatarSection = container.querySelector('.avatar-section');
			expect(avatarSection).toBeTruthy();
		});
	});

	describe('Validation', () => {
		it('validates display name minimum length', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'A' } });

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeTruthy();
			expect(errorText?.textContent).toContain('2-50 characters');
		});

		it('validates display name maximum length', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			const longName = 'A'.repeat(51);
			await fireEvent.input(input, { target: { value: longName } });

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeTruthy();
		});

		it('validates bio maximum length', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const textarea = container.querySelector('#bio') as HTMLTextAreaElement;
			const longBio = 'A'.repeat(501);
			await fireEvent.input(textarea, { target: { value: longBio } });

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeTruthy();
			expect(errorText?.textContent).toContain('500 characters');
		});

		it('accepts valid display name', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Valid Name' } });

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeFalsy();
		});

		it('accepts valid bio', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const textarea = container.querySelector('#bio') as HTMLTextAreaElement;
			await fireEvent.input(textarea, { target: { value: 'Valid bio text' } });

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeFalsy();
		});
	});

	describe('Form State', () => {
		it('disables submit button when no changes', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const submitButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Save Changes'),
			);
			expect(submitButton?.disabled).toBe(true);
		});

		it('enables submit button when changes are made', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'New Name' } });

			const submitButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Save Changes'),
			);
			expect(submitButton?.disabled).toBe(false);
		});

		it('disables submit button when form is invalid', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'A' } }); // Too short

			const submitButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Save Changes'),
			);
			expect(submitButton?.disabled).toBe(true);
		});

		it('enables reset button when changes are made', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'New Name' } });

			const resetButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Reset'),
			);
			expect(resetButton?.disabled).toBe(false);
		});
	});

	describe('Form Submission', () => {
		it('calls updateProfile with correct data', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: { ...mockProfile, display_name: 'Updated Name' },
				error: null,
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				expect(updateProfile).toHaveBeenCalledWith(
					expect.anything(),
					'user-123',
					expect.objectContaining({
						display_name: 'Updated Name',
					}),
				);
			});
		});

		it('trims whitespace from display name', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: mockProfile,
				error: null,
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: '  Trimmed Name  ' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				expect(updateProfile).toHaveBeenCalledWith(
					expect.anything(),
					'user-123',
					expect.objectContaining({
						display_name: 'Trimmed Name',
					}),
				);
			});
		});

		it('converts empty bio to null', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: mockProfile,
				error: null,
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			const textarea = container.querySelector('#bio') as HTMLTextAreaElement;

			await fireEvent.input(input, { target: { value: 'New Name' } });
			await fireEvent.input(textarea, { target: { value: '' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				expect(updateProfile).toHaveBeenCalledWith(
					expect.anything(),
					'user-123',
					expect.objectContaining({
						bio: null,
					}),
				);
			});
		});

		it('shows success message on successful update', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: { ...mockProfile, display_name: 'Updated Name' },
				error: null,
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				const successMessage = container.querySelector('.success-message');
				expect(successMessage).toBeTruthy();
				expect(successMessage?.textContent).toContain('successfully');
			});
		});

		it('shows error message on failed update', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: null,
				error: new Error('Update failed'),
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				const errorMessage = container.querySelector('.error-message');
				expect(errorMessage).toBeTruthy();
				expect(errorMessage?.textContent).toContain('Update failed');
			});
		});

		it('calls onUpdate callback on success', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			const updatedProfile = { ...mockProfile, display_name: 'Updated Name' };
			vi.mocked(updateProfile).mockResolvedValue({
				data: updatedProfile,
				error: null,
			});

			const onUpdate = vi.fn();
			const { container } = render(ProfileForm, {
				props: { profile: mockProfile, onUpdate },
			});

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				expect(onUpdate).toHaveBeenCalledWith(updatedProfile);
			});
		});

		it('disables form during submission', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			let resolveUpdate: (value: unknown) => void;
			const updatePromise = new Promise((resolve) => {
				resolveUpdate = resolve;
			});
			vi.mocked(updateProfile).mockReturnValue(updatePromise as never);

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			// Check that inputs are disabled during submission
			expect(input.disabled).toBe(true);

			// Resolve the update
			resolveUpdate!({ data: mockProfile, error: null });

			await waitFor(() => {
				expect(input.disabled).toBe(false);
			});
		});
	});

	describe('Reset Functionality', () => {
		it('resets form to original values', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			const textarea = container.querySelector('#bio') as HTMLTextAreaElement;

			// Make changes
			await fireEvent.input(input, { target: { value: 'Changed Name' } });
			await fireEvent.input(textarea, { target: { value: 'Changed bio' } });

			// Reset
			const resetButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Reset'),
			);
			await fireEvent.click(resetButton!);

			// Check values are reset
			expect(input.value).toBe('Test User');
			expect(textarea.value).toBe('Test bio');
		});

		it('clears error messages on reset', async () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'A' } }); // Invalid

			const resetButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Reset'),
			);
			await fireEvent.click(resetButton!);

			const errorText = container.querySelector('.error-text');
			expect(errorText).toBeFalsy();
		});
	});

	describe('Accessibility', () => {
		it('has proper labels for inputs', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const displayNameLabel = container.querySelector('label[for="display-name"]');
			const bioLabel = container.querySelector('label[for="bio"]');

			expect(displayNameLabel).toBeTruthy();
			expect(bioLabel).toBeTruthy();
		});

		it('marks required fields', () => {
			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const requiredMarker = container.querySelector('.required');
			expect(requiredMarker).toBeTruthy();
			expect(requiredMarker?.getAttribute('aria-label')).toBe('required');
		});

		it('uses role="alert" for error messages', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: null,
				error: new Error('Update failed'),
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				const errorMessage = container.querySelector('.error-message');
				expect(errorMessage?.getAttribute('role')).toBe('alert');
			});
		});

		it('uses role="status" for success messages', async () => {
			const { updateProfile } = await import('$lib/supabase/profiles');
			vi.mocked(updateProfile).mockResolvedValue({
				data: mockProfile,
				error: null,
			});

			const { container } = render(ProfileForm, { props: { profile: mockProfile } });

			const input = container.querySelector('#display-name') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Updated Name' } });

			const form = container.querySelector('form');
			await fireEvent.submit(form!);

			await waitFor(() => {
				const successMessage = container.querySelector('.success-message');
				expect(successMessage?.getAttribute('role')).toBe('status');
			});
		});
	});
});
