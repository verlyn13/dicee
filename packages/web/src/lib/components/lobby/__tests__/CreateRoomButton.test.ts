/**
 * CreateRoomButton Component Tests
 *
 * Tests for the room creation button component.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import CreateRoomButton from '../CreateRoomButton.svelte';

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
const mockCreateRoom = vi.fn();
const mockIsConnected = { value: false };

vi.mock('$lib/stores/room.svelte', () => {
	return {
		getRoomStore: () => ({
			createRoom: mockCreateRoom,
			get isConnected() {
				return mockIsConnected.value;
			},
		}),
	};
});

describe('CreateRoomButton', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateRoom.mockResolvedValue('ABC234');
		mockIsConnected.value = false;
	});

	it('renders with correct text', () => {
		render(CreateRoomButton);

		expect(screen.getByText('CREATE ROOM')).toBeInTheDocument();
		expect(screen.getByText('Start a new game')).toBeInTheDocument();
	});

	it('has correct button role', () => {
		render(CreateRoomButton);

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
	});

	it('calls createRoom on click', async () => {
		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(mockCreateRoom).toHaveBeenCalledWith('mock-token');
	});

	it('calls onCreated callback with room code', async () => {
		const onCreated = vi.fn();
		render(CreateRoomButton, { props: { onCreated } });

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(onCreated).toHaveBeenCalledWith('ABC234');
		});
	});

	it('shows loading state during creation', async () => {
		mockCreateRoom.mockImplementation(
			() =>
				new Promise(() => {
					/* Never resolves */
				}),
		);

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(screen.getByText('Creating...')).toBeInTheDocument();
		expect(button).toBeDisabled();
	});

	it('shows room code after creation', async () => {
		mockIsConnected.value = true;

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByText('Room Created!')).toBeInTheDocument();
			expect(screen.getByText('ABC234')).toBeInTheDocument();
		});
	});

	it('shows share hint after creation', async () => {
		mockIsConnected.value = true;

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByText('Share this code with friends')).toBeInTheDocument();
		});
	});

	it('shows error on creation failure', async () => {
		mockCreateRoom.mockRejectedValue(new Error('Server error'));

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Server error');
		});
	});

	it('applies custom class', () => {
		render(CreateRoomButton, { props: { class: 'custom-class' } });

		const button = screen.getByRole('button');
		expect(button).toHaveClass('custom-class');
	});
});

describe('CreateRoomButton: Accessibility', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateRoom.mockResolvedValue('ABC234');
		mockIsConnected.value = false;
	});

	it('has no accessibility violations', async () => {
		const { container } = render(CreateRoomButton);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has aria-busy when loading', async () => {
		mockCreateRoom.mockImplementation(
			() =>
				new Promise(() => {
					/* Never resolves */
				}),
		);

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('room code button has copy title', async () => {
		mockIsConnected.value = true;

		render(CreateRoomButton);

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		await vi.waitFor(() => {
			const codeButton = screen.getByText('ABC234');
			expect(codeButton).toHaveAttribute('title', 'Click to copy');
		});
	});
});
