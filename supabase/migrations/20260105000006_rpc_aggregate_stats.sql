-- ============================================================================
-- aggregate_game_stats: Update player stats after game completion
-- ============================================================================
-- Migration: 20260105000006_rpc_aggregate_stats
-- Purpose: Calculate and update player statistics from game results
-- Part of: Phase 4 - RPC-Based Persistence
--
-- This replaces the core stats aggregation from the edge function.
-- Glicko-2 and badges are still handled by the edge function.
--
-- Parameters:
--   p_game_id: UUID of the completed game
--
-- Returns: SETOF stats_update_result (one row per player updated)
-- ============================================================================

-- Helper function to merge category stats
CREATE OR REPLACE FUNCTION update_category_stats(
  p_existing JSONB,
  p_new_scorecard JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result JSONB;
  v_category TEXT;
  v_score INTEGER;
  v_existing_cat JSONB;
BEGIN
  v_result := COALESCE(p_existing, '{}'::jsonb);

  FOR v_category, v_score IN
    SELECT key, value::integer
    FROM jsonb_each_text(p_new_scorecard)
    WHERE value ~ '^[0-9]+$'
  LOOP
    v_existing_cat := v_result->v_category;

    IF v_existing_cat IS NULL THEN
      v_result := v_result || jsonb_build_object(
        v_category,
        jsonb_build_object(
          'attempts', 1,
          'total_score', v_score,
          'best_score', v_score,
          'avg_score', v_score
        )
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        v_category,
        jsonb_build_object(
          'attempts', (v_existing_cat->>'attempts')::integer + 1,
          'total_score', (v_existing_cat->>'total_score')::integer + v_score,
          'best_score', GREATEST((v_existing_cat->>'best_score')::integer, v_score),
          'avg_score', ((v_existing_cat->>'total_score')::integer + v_score)::numeric /
                       ((v_existing_cat->>'attempts')::integer + 1)
        )
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION update_category_stats IS
  'Helper: Merges new scorecard results into existing category statistics';

-- Main aggregation function
CREATE OR REPLACE FUNCTION aggregate_game_stats(
  p_game_id UUID
)
RETURNS SETOF stats_update_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
  v_game_mode TEXT;
  v_player_count INTEGER;
  v_result stats_update_result;
BEGIN
  -- Get game info
  SELECT game_mode INTO v_game_mode
  FROM games
  WHERE id = p_game_id AND status = 'completed';

  IF NOT FOUND THEN
    RAISE LOG 'aggregate_game_stats: Game % not found or not completed', p_game_id;
    RETURN;
  END IF;

  -- Count human players (non-AI)
  SELECT COUNT(*) INTO v_player_count
  FROM game_players
  WHERE game_id = p_game_id
    AND user_id::text NOT LIKE 'ai:%'; -- AI players have user_id starting with 'ai:'

  -- Process each human player
  FOR v_player IN
    SELECT
      gp.user_id,
      gp.final_score,
      gp.final_rank,
      gp.scorecard
    FROM game_players gp
    WHERE gp.game_id = p_game_id
      AND gp.user_id::text NOT LIKE 'ai:%'
      AND gp.final_score IS NOT NULL
  LOOP
    -- Upsert player stats
    INSERT INTO player_stats (
      user_id,
      games_played,
      games_won,
      games_completed,
      total_score,
      best_score,
      avg_score,
      updated_at
    ) VALUES (
      v_player.user_id,
      1,
      CASE WHEN v_player.final_rank = 1 AND v_player_count > 1 THEN 1 ELSE 0 END,
      1,
      v_player.final_score,
      v_player.final_score,
      v_player.final_score,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = player_stats.games_played + 1,
      games_won = player_stats.games_won +
        CASE WHEN v_player.final_rank = 1 AND v_player_count > 1 THEN 1 ELSE 0 END,
      games_completed = player_stats.games_completed + 1,
      total_score = player_stats.total_score + v_player.final_score,
      best_score = GREATEST(player_stats.best_score, v_player.final_score),
      avg_score = (player_stats.total_score + v_player.final_score)::numeric /
                  (player_stats.games_played + 1),
      updated_at = NOW();

    -- Update category stats if scorecard available
    IF v_player.scorecard IS NOT NULL AND v_player.scorecard != '{}'::jsonb THEN
      UPDATE player_stats SET
        category_stats = update_category_stats(category_stats, v_player.scorecard)
      WHERE user_id = v_player.user_id;
    END IF;

    -- Get updated stats for return
    SELECT
      ps.user_id,
      ps.games_played,
      ps.games_won,
      ARRAY[]::TEXT[] -- Badges handled separately
    INTO v_result
    FROM player_stats ps
    WHERE ps.user_id = v_player.user_id;

    RETURN NEXT v_result;
  END LOOP;

  RAISE LOG 'aggregate_game_stats: Updated stats for game %', p_game_id;

  RETURN;
END;
$$;

-- Grant execute
REVOKE EXECUTE ON FUNCTION aggregate_game_stats FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION aggregate_game_stats FROM anon;
GRANT EXECUTE ON FUNCTION aggregate_game_stats TO service_role;
GRANT EXECUTE ON FUNCTION aggregate_game_stats TO authenticated; -- For edge function

COMMENT ON FUNCTION aggregate_game_stats IS
  'Aggregates player stats after game completion. Called by edge function or directly.';
