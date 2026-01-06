-- ============================================================================
-- Custom Types for RPC Functions
-- ============================================================================
-- Migration: 20260105000001_rpc_types
-- Purpose: Define composite types used by atomic persistence RPC functions
-- Part of: Phase 4 - RPC-Based Persistence
-- ============================================================================

-- Player ranking for game completion
CREATE TYPE player_ranking AS (
  player_id UUID,
  rank SMALLINT,
  score INTEGER,
  scorecard JSONB,
  is_ai BOOLEAN
);

COMMENT ON TYPE player_ranking IS 'Player final ranking for complete_game_atomic function';

-- Result type for operations that can fail
CREATE TYPE operation_result AS (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  affected_rows INTEGER
);

COMMENT ON TYPE operation_result IS 'Standardized result type for atomic RPC functions';

-- Domain event input type
CREATE TYPE domain_event_input AS (
  id UUID,
  event_type TEXT,
  event_version TEXT,
  sequence_number BIGINT,
  game_id UUID,
  player_id UUID,
  turn_number SMALLINT,
  roll_number SMALLINT,
  payload JSONB
);

COMMENT ON TYPE domain_event_input IS 'Input type for bulk domain event persistence';

-- Player input for game creation
CREATE TYPE game_player_input AS (
  user_id UUID,
  seat_number SMALLINT,
  turn_order SMALLINT,
  is_ai BOOLEAN
);

COMMENT ON TYPE game_player_input IS 'Player input for create_game_atomic function';

-- Stats update result
CREATE TYPE stats_update_result AS (
  user_id UUID,
  games_played INTEGER,
  games_won INTEGER,
  new_badges TEXT[]
);

COMMENT ON TYPE stats_update_result IS 'Result type for aggregate_game_stats function';
