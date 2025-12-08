/**
 * Feature Flags API Unit Tests
 *
 * Tests for flags.ts - Feature flag Supabase queries
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '$lib/types/database';
import { type FeatureFlag, getAllFlags, getFlag } from '../flags';

// =============================================================================
// Mock Data
// =============================================================================

const mockFlags: FeatureFlag[] = [
	{
		id: 'ev_display',
		enabled: true,
		rollout_percent: 100,
		user_ids: [],
		min_games_played: 0,
		premium_only: false,
		description: 'EV indicators on categories',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
	},
	{
		id: 'audio_system',
		enabled: true,
		rollout_percent: 50,
		user_ids: ['beta-user-1'],
		min_games_played: 0,
		premium_only: false,
		description: 'Audio sounds',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
	},
	{
		id: 'skill_rating',
		enabled: false,
		rollout_percent: 0,
		user_ids: [],
		min_games_played: 5,
		premium_only: false,
		description: 'Skill rating display',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
	},
	{
		id: 'advanced_stats',
		enabled: true,
		rollout_percent: 0,
		user_ids: [],
		min_games_played: 0,
		premium_only: true,
		description: 'Premium stats',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
	},
];

// =============================================================================
// Mock Supabase Client
// =============================================================================

function createMockSupabase() {
	const mockSelect = vi.fn().mockReturnThis();
	const mockEq = vi.fn().mockReturnThis();
	const mockSingle = vi.fn();
	const mockFrom = vi.fn().mockReturnValue({
		select: mockSelect,
	});

	// Chain mocks
	mockSelect.mockReturnValue({
		eq: mockEq,
	});
	mockEq.mockReturnValue({
		single: mockSingle,
	});

	return {
		from: mockFrom,
		channel: vi.fn().mockReturnValue({
			on: vi.fn().mockReturnThis(),
			subscribe: vi.fn().mockReturnThis(),
		}),
		__mocks: {
			from: mockFrom,
			select: mockSelect,
			eq: mockEq,
			single: mockSingle,
		},
	} as unknown as SupabaseClient<Database> & {
		__mocks: {
			from: ReturnType<typeof vi.fn>;
			select: ReturnType<typeof vi.fn>;
			eq: ReturnType<typeof vi.fn>;
			single: ReturnType<typeof vi.fn>;
		};
	};
}

// =============================================================================
// getAllFlags Tests
// =============================================================================

describe('getAllFlags', () => {
	let mockSupabase: ReturnType<typeof createMockSupabase>;

	beforeEach(() => {
		mockSupabase = createMockSupabase();
	});

	it('should return all feature flags on success', async () => {
		mockSupabase.__mocks.select.mockResolvedValueOnce({
			data: mockFlags,
			error: null,
		});

		const result = await getAllFlags(mockSupabase);

		expect(result.data).toEqual(mockFlags);
		expect(result.error).toBeNull();
		expect(mockSupabase.from).toHaveBeenCalledWith('feature_flags');
	});

	it('should return error on failure', async () => {
		mockSupabase.__mocks.select.mockResolvedValueOnce({
			data: null,
			error: { message: 'Database error', code: 'PGRST500' },
		});

		const result = await getAllFlags(mockSupabase);

		expect(result.data).toBeNull();
		expect(result.error).toBeInstanceOf(Error);
		expect(result.error?.message).toBe('Database error');
	});
});

// =============================================================================
// getFlag Tests
// =============================================================================

describe('getFlag', () => {
	let mockSupabase: ReturnType<typeof createMockSupabase>;

	beforeEach(() => {
		mockSupabase = createMockSupabase();
	});

	it('should return a specific flag by ID', async () => {
		const expectedFlag = mockFlags[0];
		mockSupabase.__mocks.single.mockResolvedValueOnce({
			data: expectedFlag,
			error: null,
		});

		const result = await getFlag(mockSupabase, 'ev_display');

		expect(result.data).toEqual(expectedFlag);
		expect(result.error).toBeNull();
	});

	it('should return null for non-existent flag (PGRST116)', async () => {
		mockSupabase.__mocks.single.mockResolvedValueOnce({
			data: null,
			error: { message: 'No rows returned', code: 'PGRST116' },
		});

		const result = await getFlag(mockSupabase, 'nonexistent');

		expect(result.data).toBeNull();
		expect(result.error).toBeNull();
	});

	it('should return error for other database errors', async () => {
		mockSupabase.__mocks.single.mockResolvedValueOnce({
			data: null,
			error: { message: 'Connection failed', code: 'PGRST500' },
		});

		const result = await getFlag(mockSupabase, 'ev_display');

		expect(result.data).toBeNull();
		expect(result.error).toBeInstanceOf(Error);
		expect(result.error?.message).toBe('Connection failed');
	});
});
