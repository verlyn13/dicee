/**
 * PlayerListItem Component Tests
 *
 * Tests for the player display component in the lobby.
 */

import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import type { RoomPlayer } from '$lib/types/multiplayer';
import PlayerListItem from '../PlayerListItem.svelte';

const mockPlayer: RoomPlayer = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	displayName: 'TestPlayer',
	avatarSeed: 'test-seed-123',
	isConnected: true,
	isHost: false,
	joinedAt: new Date().toISOString(),
};

const mockHost: RoomPlayer = {
	...mockPlayer,
	id: '223e4567-e89b-12d3-a456-426614174001',
	displayName: 'HostPlayer',
	isHost: true,
};

const mockDisconnected: RoomPlayer = {
	...mockPlayer,
	id: '323e4567-e89b-12d3-a456-426614174002',
	displayName: 'DisconnectedPlayer',
	isConnected: false,
};

describe('PlayerListItem', () => {
	it('renders player display name', () => {
		render(PlayerListItem, { props: { player: mockPlayer } });

		expect(screen.getByText('TestPlayer')).toBeInTheDocument();
	});

	it('renders player avatar', () => {
		const { container } = render(PlayerListItem, { props: { player: mockPlayer } });

		// Avatar component renders both a div with role="img" and an img inside
		const avatarContainer = container.querySelector('.avatar');
		expect(avatarContainer).toBeInTheDocument();
		expect(avatarContainer).toHaveAttribute('aria-label', "TestPlayer's avatar");
	});

	it('shows host badge for host player', () => {
		render(PlayerListItem, { props: { player: mockHost } });

		expect(screen.getByText('HOST')).toBeInTheDocument();
	});

	it('does not show host badge for non-host player', () => {
		render(PlayerListItem, { props: { player: mockPlayer } });

		expect(screen.queryByText('HOST')).not.toBeInTheDocument();
	});

	it('shows "(you)" badge for current user', () => {
		render(PlayerListItem, { props: { player: mockPlayer, isCurrentUser: true } });

		expect(screen.getByText('(you)')).toBeInTheDocument();
	});

	it('does not show "(you)" badge for other players', () => {
		render(PlayerListItem, { props: { player: mockPlayer, isCurrentUser: false } });

		expect(screen.queryByText('(you)')).not.toBeInTheDocument();
	});

	it('shows reconnecting status for disconnected player', () => {
		render(PlayerListItem, { props: { player: mockDisconnected } });

		expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
	});

	it('does not show reconnecting status for connected player', () => {
		render(PlayerListItem, { props: { player: mockPlayer } });

		expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
	});

	it('applies current user styling', () => {
		const { container } = render(PlayerListItem, {
			props: { player: mockPlayer, isCurrentUser: true },
		});

		const playerItem = container.querySelector('.player-item');
		expect(playerItem).toHaveClass('player-item--current');
	});

	it('applies disconnected styling', () => {
		const { container } = render(PlayerListItem, { props: { player: mockDisconnected } });

		const playerItem = container.querySelector('.player-item');
		expect(playerItem).toHaveClass('player-item--disconnected');
	});

	it('applies custom class', () => {
		const { container } = render(PlayerListItem, {
			props: { player: mockPlayer, class: 'custom-class' },
		});

		const playerItem = container.querySelector('.player-item');
		expect(playerItem).toHaveClass('className');
	});
});

describe('PlayerListItem: Accessibility', () => {
	it('has no accessibility violations', async () => {
		const { container } = render(PlayerListItem, { props: { player: mockPlayer } });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has no accessibility violations for host', async () => {
		const { container } = render(PlayerListItem, { props: { player: mockHost } });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});

	it('has no accessibility violations for disconnected player', async () => {
		const { container } = render(PlayerListItem, { props: { player: mockDisconnected } });

		const results = await axe(container);
		expect(results).toHaveNoViolations();
	});
});
