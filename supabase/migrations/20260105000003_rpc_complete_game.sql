-- ============================================================================
-- complete_game_atomic: Atomically complete game and update all players
-- ============================================================================
-- Migration: 20260105000003_rpc_complete_game
-- Purpose: Mark game completed and update all player scores/ranks atomically
-- Part of: Phase 4 - RPC-Based Persistence
--
-- Parameters:
--   p_game_id: UUID of the game to complete
--   p_winner_id: UUID of the winning player (nullable for ties/solo)
--   p_rankings: Array of player_ranking records
--   p_completed_at: Completion timestamp (defaults to NOW())
--
-- Returns: operation_result
--
-- Example:
--   SELECT * FROM complete_game_atomic(
--     'game-uuid',
--     'winner-uuid',
--     ARRAY[
--       ROW('player1-uuid', 1, 285, '{"ones": 3, "twos": 6}', false)::player_ranking,
--       ROW('player2-uuid', 2, 220, '{"ones": 2, "twos": 4}', false)::player_ranking
--     ]
--   );
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_game_atomic(
  p_game_id UUID,
  p_winner_id UUID,
  p_rankings player_ranking[],
  p_completed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS operation_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ranking player_ranking;
  v_current_status TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  -- Validate game exists and is in correct state
  SELECT status INTO v_current_status
  FROM games
  WHERE id = p_game_id
  FOR UPDATE; -- Lock the row

  IF NOT FOUND THEN
    RETURN ROW(false, 'NOT_FOUND', 'Game does not exist', 0)::operation_result;
  END IF;

  -- Idempotency: If already completed, verify and return success
  IF v_current_status = 'completed' THEN
    RAISE LOG 'complete_game_atomic: Game % already completed, returning success', p_game_id;
    RETURN ROW(true, NULL, 'Already completed', 0)::operation_result;
  END IF;

  IF v_current_status != 'active' THEN
    RETURN ROW(false, 'INVALID_STATE', 'Game is not active (status: ' || v_current_status || ')', 0)::operation_result;
  END IF;

  -- Update game record
  UPDATE games SET
    status = 'completed',
    winner_id = p_winner_id,
    completed_at = p_completed_at
  WHERE id = p_game_id;

  v_updated_count := v_updated_count + 1;

  -- Update each player's record
  FOREACH v_ranking IN ARRAY p_rankings
  LOOP
    UPDATE game_players SET
      final_score = v_ranking.score,
      final_rank = v_ranking.rank,
      scorecard = v_ranking.scorecard,
      is_connected = false,
      left_at = COALESCE(left_at, p_completed_at)
    WHERE game_id = p_game_id
      AND user_id = v_ranking.player_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Player % not found in game %', v_ranking.player_id, p_game_id;
    END IF;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RAISE LOG 'complete_game_atomic: Completed game % with % updates', p_game_id, v_updated_count;

  RETURN ROW(true, NULL, NULL, v_updated_count)::operation_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will be automatically rolled back
    RAISE LOG 'complete_game_atomic error: % %', SQLSTATE, SQLERRM;
    RETURN ROW(false, SQLSTATE, SQLERRM, 0)::operation_result;
END;
$$;

-- Grant execute to service role only
REVOKE EXECUTE ON FUNCTION complete_game_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_game_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION complete_game_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION complete_game_atomic TO service_role;

COMMENT ON FUNCTION complete_game_atomic IS
  'Atomically completes a game and updates all player records. Idempotent - safe to retry.';
