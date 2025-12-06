/**
 * RoomLobby Component Tests
 *
 * Tests for the main lobby view when connected to a room.
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { GameRoom } from '$lib/types/multiplayer';
import RoomLobby from '../RoomLobby.svelte';

// Mock auth store
vi.mock('$lib/stores/auth.svelte', () => {
	return {
		auth: {
			userId: 'user-123',
		},
	};
});

// Mock room store
const mockLeaveRoom = vi.fn();
const mockStartGame = vi.fn();
const mockSubscribe = vi.fn(() => () => {
	// unsubscribe no-op
});

const mockRoom: GameRoom = {
	code: 'ABC234',
	config: {
		isPublic: false,
		allowSpectators: false,
		turnTimeoutSeconds: 60,
		maxPlayers: 4,
	},
	state: 'waiting',
	players: [
		{
			id: 'user-123',
			displayName: 'Player1',
			avatarSeed: 'seed1',
			isConnected: true,
			isHost: true,
			joinedAt: new Date().toISOString(),
		},
		{
			id: 'user-456',
			displayName: 'Player2',
			avatarSeed: 'seed2',
			isConnected: true,
			isHost: false,
			joinedAt: new Date().toISOString(),
		},
	],
	hostId: 'user-123',
	createdAt: new Date().toISOString(),
	startedAt: null,
};

const mockRoomStore: {
	roomCode: string;
	room: GameRoom;
	playerCount: number;
	isHost: boolean;
	isFull: boolean;
	canStart: boolean;
	error: string | null;
	leaveRoom: typeof mockLeaveRoom;
	startGame: typeof mockStartGame;
	subscribe: typeof mockSubscribe;
} = {
	roomCode: 'ABC234',
	room: mockRoom,
	playerCount: 2,
	isHost: true,
	isFull: false,
	canStart: true,
	error: null,
	leaveRoom: mockLeaveRoom,
	startGame: mockStartGame,
	subscribe: mockSubscribe,
};

vi.mock('$lib/stores/room.svelte', () => {
	return {
		getRoomStore: () => mockRoomStore,
	};
});

describe('RoomLobby', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock store state
		mockRoomStore.isHost = true;
		mockRoomStore.canStart = true;
		mockRoomStore.playerCount = 2;
		mockRoomStore.error = null;
	});

	it('renders room code', () => {
		render(RoomLobby);

		expect(screen.getByText('ABC234')).toBeInTheDocument();
		expect(screen.getByText('ROOM CODE')).toBeInTheDocument();
	});

	it('renders player count', () => {
		render(RoomLobby);

		expect(screen.getByText('Players (2/4)')).toBeInTheDocument();
	});

	it('renders all players', () => {
		render(RoomLobby);

		expect(screen.getByText('Player1')).toBeInTheDocument();
		expect(screen.getByText('Player2')).toBeInTheDocument();
	});

	it('shows leave button', () => {
		render(RoomLobby);

		expect(screen.getByRole('button', { name: 'LEAVE' })).toBeInTheDocument();
	});

	it('calls leaveRoom and onleave on leave click', async () => {
		const onleave = vi.fn();
		render(RoomLobby, { props: { onleave } });

		const leaveButton = screen.getByRole('button', { name: 'LEAVE' });
		await fireEvent.click(leaveButton);

		expect(mockLeaveRoom).toHaveBeenCalled();
		expect(onleave).toHaveBeenCalled();
	});

	it('shows start button for host when canStart', () => {
		render(RoomLobby);

		expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument();
	});

	it('calls startGame on start click', async () => {
		render(RoomLobby);

		const startButton = screen.getByRole('button', { name: 'START GAME' });
		await fireEvent.click(startButton);

		expect(mockStartGame).toHaveBeenCalled();
	});

	it('shows waiting message for non-host', () => {
		mockRoomStore.isHost = false;
		mockRoomStore.canStart = false;

		render(RoomLobby);

		expect(screen.getByText('Waiting for host to start...')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'START GAME' })).not.toBeInTheDocument();
	});

	it('shows waiting for players message when not enough players', () => {
		mockRoomStore.playerCount = 1;
		mockRoomStore.canStart = false;

		render(RoomLobby);

		expect(screen.getByText('Waiting for more players...')).toBeInTheDocument();
	});

	it('shows invite hint when room not full', () => {
		mockRoomStore.isFull = false;

		render(RoomLobby);

		expect(screen.getByText('Share the room code to invite friends!')).toBeInTheDocument();
	});

	it('hides invite hint when room is full', () => {
		mockRoomStore.isFull = true;

		render(RoomLobby);

		expect(screen.queryByText('Share the room code to invite friends!')).not.toBeInTheDocument();
	});

	it('shows error message when error exists', () => {
		mockRoomStore.error = 'Connection lost';

		render(RoomLobby);

		expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
	});

	it('room code button has copy title', () => {
		render(RoomLobby);

		const codeButton = screen.getByText('ABC234');
		expect(codeButton).toHaveAttribute('title', 'Click to copy');
	});

	it('applies custom class', () => {
		const { container } = render(RoomLobby, { props: { class: 'custom-class' } });

		const lobby = container.querySelector('.room-lobby');
		expect(lobby).toHaveClass('custom-class');
	});
});

describe('RoomLobby: Accessibility', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRoomStore.isHost = true;
		mockRoomStore.canStart = true;
		mockRoomStore.error = null;
	});

	it('has no accessibility violations', async () => {
		const { container } = render(RoomLobby);

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has proper heading structure', () => {
		render(RoomLobby);

		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading).toHaveTextContent('Players');
	});
});
