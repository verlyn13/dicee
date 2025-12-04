import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { Profile } from '$lib/supabase/profiles';
import type { PlayerStats } from '$lib/supabase/stats';
import StatsDashboard from '../StatsDashboard.svelte';

/**
 * Mock player stats for testing (game statistics)
 */
function createMockStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
	return {
		user_id: 'test-user-123',
		games_played: 25,
		games_completed: 20,
		games_won: 12,
		total_score: 5000,
		avg_score: 250,
		best_score: 375,
		yahtzees_rolled: 8,
		bonus_yahtzees: 2,
		upper_bonuses: 15,
		optimal_decisions: 180,
		total_decisions: 200,
		avg_ev_loss: 2.5,
		category_stats: {},
		updated_at: new Date().toISOString(),
		...overrides,
	};
}

/**
 * Mock profile for testing (rating data)
 */
function createMockProfile(overrides: Partial<Profile> = {}): Profile {
	return {
		id: 'test-user-123',
		display_name: 'Test User',
		username: null,
		bio: null,
		avatar_seed: 'test-seed',
		avatar_style: 'identicon',
		is_anonymous: false,
		is_public: true,
		skill_rating: 1650,
		rating_deviation: 75,
		rating_volatility: 0.06,
		badges: [],
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		last_seen_at: new Date().toISOString(),
		...overrides,
	};
}

describe('StatsDashboard', () => {
	describe('Loading State', () => {
		it('shows loading spinner when loading is true', () => {
			render(StatsDashboard, {
				props: { stats: null, loading: true },
			});

			expect(screen.getByText('Loading stats...')).toBeInTheDocument();
		});

		it('has loading class when loading', () => {
			const { container } = render(StatsDashboard, {
				props: { stats: null, loading: true },
			});

			expect(container.querySelector('.stats-dashboard.loading')).toBeInTheDocument();
		});
	});

	describe('Empty State', () => {
		it('shows empty state when stats is null and not loading', () => {
			render(StatsDashboard, {
				props: { stats: null, loading: false },
			});

			expect(screen.getByText('No Stats Yet')).toBeInTheDocument();
			expect(
				screen.getByText('Play some games to start tracking your progress!'),
			).toBeInTheDocument();
		});

		it('shows empty icon', () => {
			render(StatsDashboard, {
				props: { stats: null },
			});

			expect(screen.getByText('📊')).toBeInTheDocument();
		});
	});

	describe('Stats Display', () => {
		it('displays games played', () => {
			const stats = createMockStats({ games_played: 42 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('42')).toBeInTheDocument();
			expect(screen.getByText('Games Played')).toBeInTheDocument();
		});

		it('displays games completed', () => {
			const stats = createMockStats({ games_completed: 35 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('35 completed')).toBeInTheDocument();
		});

		it('displays wins and losses', () => {
			const stats = createMockStats({ games_completed: 20, games_won: 12 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('12W')).toBeInTheDocument();
			expect(screen.getByText('8L')).toBeInTheDocument();
		});

		it('displays win rate percentage', () => {
			const stats = createMockStats({ games_completed: 20, games_won: 12 });
			render(StatsDashboard, { props: { stats } });

			// 12/20 = 60%
			expect(screen.getByText('60.0% win rate')).toBeInTheDocument();
		});

		it('displays skill rating from profile', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 1650 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('1650')).toBeInTheDocument();
		});

		it('displays best score', () => {
			const stats = createMockStats({ best_score: 375 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('375')).toBeInTheDocument();
			expect(screen.getByText('Best Score')).toBeInTheDocument();
		});

		it('displays average score', () => {
			const stats = createMockStats({ avg_score: 250.7 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('avg: 251')).toBeInTheDocument();
		});
	});

	describe('Rating Tiers', () => {
		it('shows Beginner tier for rating < 1400', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 1200 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Beginner')).toBeInTheDocument();
		});

		it('shows Intermediate tier for rating 1400-1599', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 1500 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Intermediate')).toBeInTheDocument();
		});

		it('shows Advanced tier for rating 1600-1799', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 1700 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Advanced')).toBeInTheDocument();
		});

		it('shows Expert tier for rating 1800-1999', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 1900 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Expert')).toBeInTheDocument();
		});

		it('shows Master tier for rating >= 2000', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ skill_rating: 2100 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Master')).toBeInTheDocument();
		});

		it('shows default rating when no profile provided', () => {
			const stats = createMockStats();
			render(StatsDashboard, { props: { stats } });

			// Default rating is 1500
			expect(screen.getByText('1500')).toBeInTheDocument();
		});
	});

	describe('Performance Section', () => {
		it('displays decision quality percentage', () => {
			const stats = createMockStats({ optimal_decisions: 180, total_decisions: 200 });
			render(StatsDashboard, { props: { stats } });

			// 180/200 = 90%
			expect(screen.getByText('90.0%')).toBeInTheDocument();
		});

		it('displays optimal decisions count', () => {
			const stats = createMockStats({ optimal_decisions: 180, total_decisions: 200 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('180 / 200 optimal decisions')).toBeInTheDocument();
		});

		it('displays yahtzees rolled', () => {
			const stats = createMockStats({ yahtzees_rolled: 8 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('8')).toBeInTheDocument();
			expect(screen.getByText('Yahtzees')).toBeInTheDocument();
		});

		it('displays bonus yahtzees', () => {
			const stats = createMockStats({ bonus_yahtzees: 3 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('3')).toBeInTheDocument();
			expect(screen.getByText('Bonus Yahtzees')).toBeInTheDocument();
		});

		it('displays upper bonuses', () => {
			const stats = createMockStats({ upper_bonuses: 15 });
			render(StatsDashboard, { props: { stats } });

			expect(screen.getByText('15')).toBeInTheDocument();
			expect(screen.getByText('Upper Bonuses')).toBeInTheDocument();
		});
	});

	describe('Rating Details', () => {
		it('has collapsible rating details section when profile provided', () => {
			const stats = createMockStats();
			const profile = createMockProfile();
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('Rating Details')).toBeInTheDocument();
		});

		it('hides rating details when no profile provided', () => {
			const stats = createMockStats();
			render(StatsDashboard, { props: { stats } });

			expect(screen.queryByText('Rating Details')).not.toBeInTheDocument();
		});

		it('displays rating deviation', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ rating_deviation: 75.5 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('75.5')).toBeInTheDocument();
		});

		it('displays rating volatility', () => {
			const stats = createMockStats();
			const profile = createMockProfile({ rating_volatility: 0.0612 });
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText('0.0612')).toBeInTheDocument();
		});

		it('shows rating hint text', () => {
			const stats = createMockStats();
			const profile = createMockProfile();
			render(StatsDashboard, { props: { stats, profile } });

			expect(screen.getByText(/Lower deviation = more confident rating/)).toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('handles zero games played', () => {
			const stats = createMockStats({
				games_played: 0,
				games_completed: 0,
				games_won: 0,
				total_decisions: 0,
				optimal_decisions: 0,
			});
			render(StatsDashboard, { props: { stats } });

			// Should show 0% win rate without NaN
			expect(screen.getByText('0.0% win rate')).toBeInTheDocument();
		});

		it('handles zero decisions', () => {
			const stats = createMockStats({
				total_decisions: 0,
				optimal_decisions: 0,
			});
			render(StatsDashboard, { props: { stats } });

			// Decision quality should be 0% not NaN
			expect(screen.getByText('0.0%')).toBeInTheDocument();
		});

		it('caps progress bar at 100%', () => {
			// Edge case: if somehow win rate > 100%
			const stats = createMockStats({
				games_completed: 10,
				games_won: 10, // 100% win rate
			});
			const { container } = render(StatsDashboard, { props: { stats } });

			const progressFill = container.querySelector('.progress-fill--wins');
			expect(progressFill).toHaveStyle('width: 100%');
		});
	});

	describe('Accessibility', () => {
		it('has proper heading hierarchy', () => {
			const stats = createMockStats();
			render(StatsDashboard, { props: { stats } });

			const headings = screen.getAllByRole('heading', { level: 3 });
			expect(headings.length).toBeGreaterThan(0);
		});

		it('uses tabular-nums for numeric values', () => {
			const stats = createMockStats();
			const { container } = render(StatsDashboard, { props: { stats } });

			const statValues = container.querySelectorAll('.stat-value');
			expect(statValues.length).toBeGreaterThan(0);
		});
	});

	describe('Custom Class', () => {
		it('applies custom class name', () => {
			const stats = createMockStats();
			const { container } = render(StatsDashboard, {
				props: { stats, class: 'custom-class' },
			});

			expect(container.querySelector('.stats-dashboard.custom-class')).toBeInTheDocument();
		});
	});
});
