import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameHistoryEntry } from '$lib/supabase/stats';
import GameHistory from '../GameHistory.svelte';

/**
 * Create mock game history entry
 */
function createMockGame(overrides: Partial<GameHistoryEntry> = {}): GameHistoryEntry {
	return {
		game_id: `game-${Math.random().toString(36).slice(2)}`,
		game_mode: 'solo',
		completed_at: new Date().toISOString(),
		final_score: 250,
		final_rank: 1,
		player_count: 1,
		won: true,
		...overrides,
	};
}

/**
 * Create multiple mock games
 */
function createMockGames(
	count: number,
	baseOverrides: Partial<GameHistoryEntry> = {},
): GameHistoryEntry[] {
	return Array.from({ length: count }, (_, i) => {
		const date = new Date();
		date.setDate(date.getDate() - i);
		return createMockGame({
			game_id: `game-${i}`,
			completed_at: date.toISOString(),
			final_score: 200 + i * 10,
			won: i % 2 === 0,
			...baseOverrides,
		});
	});
}

describe('GameHistory', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-12-04T12:00:00Z'));
	});

	describe('Loading State', () => {
		it('shows loading spinner when loading with no games', () => {
			render(GameHistory, {
				props: { games: null, loading: true },
			});

			expect(screen.getByText('Loading game history...')).toBeInTheDocument();
		});

		it('has loading class when loading', () => {
			const { container } = render(GameHistory, {
				props: { games: null, loading: true },
			});

			expect(container.querySelector('.game-history.loading')).toBeInTheDocument();
		});

		it('shows games with loading overlay when loading more', () => {
			const games = createMockGames(3);
			const { container } = render(GameHistory, {
				props: { games, loading: true },
			});

			// Games should still be visible
			expect(screen.getAllByRole('listitem')).toHaveLength(3);
			// But with loading class
			expect(container.querySelector('.game-history.loading')).toBeInTheDocument();
		});
	});

	describe('Error State', () => {
		it('shows error message', () => {
			render(GameHistory, {
				props: { games: null, error: 'Failed to load games' },
			});

			expect(screen.getByText('Failed to load games')).toBeInTheDocument();
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});

		it('shows error icon', () => {
			render(GameHistory, {
				props: { games: null, error: 'Network error' },
			});

			expect(screen.getByText('⚠')).toBeInTheDocument();
		});
	});

	describe('Empty State', () => {
		it('shows empty state when games is null', () => {
			render(GameHistory, {
				props: { games: null },
			});

			expect(screen.getByText('No Games Yet')).toBeInTheDocument();
			expect(screen.getByText('Your completed games will appear here.')).toBeInTheDocument();
		});

		it('shows empty state when games array is empty', () => {
			render(GameHistory, {
				props: { games: [] },
			});

			expect(screen.getByText('No Games Yet')).toBeInTheDocument();
		});

		it('shows empty icon', () => {
			render(GameHistory, {
				props: { games: [] },
			});

			expect(screen.getByText('🎲')).toBeInTheDocument();
		});
	});

	describe('Games List', () => {
		it('renders list of games', () => {
			const games = createMockGames(5);
			render(GameHistory, { props: { games } });

			expect(screen.getAllByRole('listitem')).toHaveLength(5);
		});

		it('shows WIN badge for won games', () => {
			const games = [createMockGame({ won: true })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('WIN')).toBeInTheDocument();
		});

		it('shows LOSS badge for lost games', () => {
			const games = [createMockGame({ won: false })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('LOSS')).toBeInTheDocument();
		});

		it('displays game score', () => {
			const games = [createMockGame({ final_score: 325 })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('325')).toBeInTheDocument();
		});

		it('displays dash for null score', () => {
			const games = [createMockGame({ final_score: null })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('-')).toBeInTheDocument();
		});

		it('displays game mode', () => {
			const games = [createMockGame({ game_mode: 'multiplayer' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Multiplayer')).toBeInTheDocument();
		});
	});

	describe('Rank Display', () => {
		it('shows rank for multiplayer games', () => {
			const games = [createMockGame({ player_count: 4, final_rank: 2 })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('2nd')).toBeInTheDocument();
		});

		it('hides rank for solo games', () => {
			const games = [createMockGame({ player_count: 1, final_rank: 1 })];
			render(GameHistory, { props: { games } });

			// Should not show rank column for solo games
			expect(screen.queryByText('Rank')).not.toBeInTheDocument();
		});

		it('formats 1st place correctly', () => {
			const games = [createMockGame({ player_count: 2, final_rank: 1 })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('1st')).toBeInTheDocument();
		});

		it('formats 3rd place correctly', () => {
			const games = [createMockGame({ player_count: 4, final_rank: 3 })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('3rd')).toBeInTheDocument();
		});

		it('formats 4th+ place correctly', () => {
			const games = [createMockGame({ player_count: 5, final_rank: 4 })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('4th')).toBeInTheDocument();
		});
	});

	describe('Date Formatting', () => {
		it('shows "Just now" for very recent games', () => {
			const games = [createMockGame({ completed_at: new Date().toISOString() })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Just now')).toBeInTheDocument();
		});

		it('shows minutes ago for recent games', () => {
			const date = new Date();
			date.setMinutes(date.getMinutes() - 30);
			const games = [createMockGame({ completed_at: date.toISOString() })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('30m ago')).toBeInTheDocument();
		});

		it('shows hours ago for games today', () => {
			const date = new Date();
			date.setHours(date.getHours() - 3);
			const games = [createMockGame({ completed_at: date.toISOString() })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('3h ago')).toBeInTheDocument();
		});

		it('shows "Yesterday" for games from yesterday', () => {
			const date = new Date();
			date.setDate(date.getDate() - 1);
			const games = [createMockGame({ completed_at: date.toISOString() })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Yesterday')).toBeInTheDocument();
		});

		it('shows days ago for recent games', () => {
			const date = new Date();
			date.setDate(date.getDate() - 3);
			const games = [createMockGame({ completed_at: date.toISOString() })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('3 days ago')).toBeInTheDocument();
		});

		it('shows formatted date for older games', () => {
			const date = new Date();
			date.setDate(date.getDate() - 14);
			const games = [createMockGame({ completed_at: date.toISOString() })];
			render(GameHistory, { props: { games } });

			// Should show "Nov 20" or similar
			expect(screen.getByText(/Nov \d+/)).toBeInTheDocument();
		});

		it('shows "Unknown" for null date', () => {
			const games = [createMockGame({ completed_at: null })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Unknown')).toBeInTheDocument();
		});
	});

	describe('Max Display', () => {
		it('limits displayed games to maxDisplay', () => {
			const games = createMockGames(20);
			render(GameHistory, {
				props: { games, maxDisplay: 5 },
			});

			expect(screen.getAllByRole('listitem')).toHaveLength(5);
		});

		it('shows games count', () => {
			const games = createMockGames(15);
			render(GameHistory, {
				props: { games, maxDisplay: 10 },
			});

			expect(screen.getByText('Showing 10 of 15 games')).toBeInTheDocument();
		});

		it('shows all games when fewer than maxDisplay', () => {
			const games = createMockGames(3);
			render(GameHistory, {
				props: { games, maxDisplay: 10 },
			});

			expect(screen.getAllByRole('listitem')).toHaveLength(3);
			expect(screen.getByText('Showing 3 of 3 games')).toBeInTheDocument();
		});
	});

	describe('Load More', () => {
		it('shows Load More button when hasMore is true', () => {
			const games = createMockGames(5);
			const onLoadMore = vi.fn();
			render(GameHistory, {
				props: { games, hasMore: true, onLoadMore },
			});

			expect(screen.getByText('Load More')).toBeInTheDocument();
		});

		it('hides Load More button when hasMore is false', () => {
			const games = createMockGames(5);
			render(GameHistory, {
				props: { games, hasMore: false },
			});

			expect(screen.queryByText('Load More')).not.toBeInTheDocument();
		});

		it('calls onLoadMore when clicked', async () => {
			const games = createMockGames(5);
			const onLoadMore = vi.fn();
			render(GameHistory, {
				props: { games, hasMore: true, onLoadMore },
			});

			await fireEvent.click(screen.getByText('Load More'));
			expect(onLoadMore).toHaveBeenCalledOnce();
		});

		it('shows Loading... when loading more', () => {
			const games = createMockGames(5);
			const onLoadMore = vi.fn();
			render(GameHistory, {
				props: { games, hasMore: true, onLoadMore, loading: true },
			});

			expect(screen.getByText('Loading...')).toBeInTheDocument();
		});

		it('disables button when loading', () => {
			const games = createMockGames(5);
			const onLoadMore = vi.fn();
			render(GameHistory, {
				props: { games, hasMore: true, onLoadMore, loading: true },
			});

			expect(screen.getByRole('button')).toBeDisabled();
		});
	});

	describe('Game Mode Formatting', () => {
		it('formats solo mode', () => {
			const games = [createMockGame({ game_mode: 'solo' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Solo')).toBeInTheDocument();
		});

		it('formats multiplayer mode', () => {
			const games = [createMockGame({ game_mode: 'multiplayer' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Multiplayer')).toBeInTheDocument();
		});

		it('formats practice mode', () => {
			const games = [createMockGame({ game_mode: 'practice' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Practice')).toBeInTheDocument();
		});

		it('formats ranked mode', () => {
			const games = [createMockGame({ game_mode: 'ranked' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Ranked')).toBeInTheDocument();
		});

		it('shows raw mode for unknown modes', () => {
			const games = [createMockGame({ game_mode: 'tournament' })];
			render(GameHistory, { props: { games } });

			expect(screen.getByText('tournament')).toBeInTheDocument();
		});
	});

	describe('Styling', () => {
		it('applies won class to winning games', () => {
			const games = [createMockGame({ won: true })];
			const { container } = render(GameHistory, { props: { games } });

			expect(container.querySelector('.game-item.won')).toBeInTheDocument();
		});

		it('does not apply won class to lost games', () => {
			const games = [createMockGame({ won: false })];
			const { container } = render(GameHistory, { props: { games } });

			expect(container.querySelector('.game-item.won')).not.toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('has section title', () => {
			const games = createMockGames(3);
			render(GameHistory, { props: { games } });

			expect(screen.getByText('Recent Games')).toBeInTheDocument();
		});

		it('uses list role for games', () => {
			const games = createMockGames(3);
			render(GameHistory, { props: { games } });

			expect(screen.getByRole('list')).toBeInTheDocument();
		});

		it('uses listitem role for each game', () => {
			const games = createMockGames(3);
			render(GameHistory, { props: { games } });

			expect(screen.getAllByRole('listitem')).toHaveLength(3);
		});
	});

	describe('Custom Class', () => {
		it('applies custom class name', () => {
			const games = createMockGames(3);
			const { container } = render(GameHistory, {
				props: { games, class: 'custom-class' },
			});

			expect(container.querySelector('.game-history.custom-class')).toBeInTheDocument();
		});
	});
});
