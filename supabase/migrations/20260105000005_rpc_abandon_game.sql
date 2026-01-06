-- ============================================================================
-- abandon_game_atomic: Mark a game as abandoned
-- ============================================================================
-- Migration: 20260105000005_rpc_abandon_game
-- Purpose: Mark game abandoned and update player states atomically
-- Part of: Phase 4 - RPC-Based Persistence
--
-- Used when a game ends prematurely (all players left, timeout, etc.)
--
-- Parameters:
--   p_game_id: UUID of the game to abandon
--   p_reason: Reason for abandonment
--   p_abandoned_at: Abandonment timestamp (defaults to NOW())
--
-- Returns: operation_result
-- ============================================================================

CREATE OR REPLACE FUNCTION abandon_game_atomic(
  p_game_id UUID,
  p_reason TEXT,
  p_abandoned_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS operation_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Get current status with lock
  SELECT status INTO v_current_status
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN ROW(false, 'NOT_FOUND', 'Game does not exist', 0)::operation_result;
  END IF;

  -- Idempotency check
  IF v_current_status IN ('completed', 'abandoned') THEN
    RETURN ROW(true, NULL, 'Game already ended', 0)::operation_result;
  END IF;

  -- Update game status
  UPDATE games SET
    status = 'abandoned',
    completed_at = p_abandoned_at,
    settings = settings || jsonb_build_object('abandonment_reason', p_reason)
  WHERE id = p_game_id;

  -- Mark all players as disconnected
  UPDATE game_players SET
    is_connected = false,
    left_at = COALESCE(left_at, p_abandoned_at)
  WHERE game_id = p_game_id
    AND is_connected = true;

  RAISE LOG 'abandon_game_atomic: Abandoned game % reason: %', p_game_id, p_reason;

  RETURN ROW(true, NULL, NULL, 1)::operation_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'abandon_game_atomic error: % %', SQLSTATE, SQLERRM;
    RETURN ROW(false, SQLSTATE, SQLERRM, 0)::operation_result;
END;
$$;

-- Grant execute to service role only
REVOKE EXECUTE ON FUNCTION abandon_game_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION abandon_game_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION abandon_game_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION abandon_game_atomic TO service_role;

COMMENT ON FUNCTION abandon_game_atomic IS
  'Atomically marks a game as abandoned. Idempotent.';
