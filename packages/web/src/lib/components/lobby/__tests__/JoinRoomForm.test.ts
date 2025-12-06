/**
 * JoinRoomForm Component Tests
 *
 * Tests for the room code input and join form.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import JoinRoomForm from '../JoinRoomForm.svelte';

// Mock the auth store
vi.mock('$lib/stores/auth.svelte', () => {
	return {
		auth: {
			isAuthenticated: true,
			session: {
				access_token: 'mock-token',
			},
		},
	};
});

// Mock the room store
const mockJoinRoom = vi.fn();
vi.mock('$lib/stores/room.svelte', () => {
	return {
		getRoomStore: () => ({
			joinRoom: mockJoinRoom,
		}),
	};
});

// Mock the schema validation
vi.mock('$lib/types/multiplayer.schema', () => {
	return {
		isValidRoomCode: (code: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(code),
	};
});

describe('JoinRoomForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockJoinRoom.mockResolvedValue(undefined);
	});

	it('renders form with label and input', () => {
		render(JoinRoomForm);

		expect(screen.getByText('Join a Room')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('ABC123')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'JOIN' })).toBeInTheDocument();
	});

	it('formats input to uppercase', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement;
		// Note: 1 is invalid (ambiguous char), so 'abc123' becomes 'ABC23'
		await fireEvent.input(input, { target: { value: 'abc234' } });

		expect(input.value).toBe('ABC234');
	});

	it('removes invalid characters from input', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement;
		// O, 0, 1, I, L are invalid
		await fireEvent.input(input, { target: { value: 'ABO01I' } });

		expect(input.value).toBe('AB');
	});

	it('limits input to 6 characters', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'ABCDEFGH' } });

		expect(input.value).toBe('ABCDEF');
	});

	it('disables join button when code is too short', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC' } });

		const button = screen.getByRole('button', { name: 'JOIN' });
		expect(button).toBeDisabled();
	});

	it('enables join button when code is valid', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC234' } });

		const button = screen.getByRole('button', { name: 'JOIN' });
		expect(button).not.toBeDisabled();
	});

	it('calls joinRoom on valid submit', async () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC234' } });

		const form = screen.getByRole('button', { name: 'JOIN' }).closest('form')!;
		await fireEvent.submit(form);

		expect(mockJoinRoom).toHaveBeenCalledWith('ABC234', 'mock-token');
	});

	it('calls onjoined callback on success', async () => {
		const onjoined = vi.fn();
		render(JoinRoomForm, { props: { onjoined } });

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC234' } });

		const form = screen.getByRole('button', { name: 'JOIN' }).closest('form')!;
		await fireEvent.submit(form);

		await vi.waitFor(() => {
			expect(onjoined).toHaveBeenCalledWith('ABC234');
		});
	});

	it('shows error on join failure', async () => {
		mockJoinRoom.mockRejectedValue(new Error('Room not found'));

		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC234' } });

		const form = screen.getByRole('button', { name: 'JOIN' }).closest('form')!;
		await fireEvent.submit(form);

		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Room not found');
		});
	});

	it('shows error for invalid code format', async () => {
		render(JoinRoomForm);

		// Manually set an invalid code (bypassing input handler)
		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABCDE' } });

		const form = screen.getByRole('button', { name: 'JOIN' }).closest('form')!;
		await fireEvent.submit(form);

		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Room code must be 6 characters');
		});
	});

	it('applies custom class', () => {
		const { container } = render(JoinRoomForm, { props: { class: 'custom-class' } });

		const form = container.querySelector('form');
		expect(form).toHaveClass('custom-class');
	});
});

describe('JoinRoomForm: Accessibility', () => {
	it('has no accessibility violations', async () => {
		const { container } = render(JoinRoomForm);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has proper label association', () => {
		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		expect(input).toHaveAttribute('id', 'room-code-input');

		const label = screen.getByText('Join a Room');
		expect(label).toHaveAttribute('for', 'room-code-input');
	});

	it('has aria-invalid when error present', async () => {
		mockJoinRoom.mockRejectedValue(new Error('Failed'));

		render(JoinRoomForm);

		const input = screen.getByPlaceholderText('ABC123');
		await fireEvent.input(input, { target: { value: 'ABC234' } });

		const form = screen.getByRole('button', { name: 'JOIN' }).closest('form')!;
		await fireEvent.submit(form);

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-invalid', 'true');
		});
	});
});
