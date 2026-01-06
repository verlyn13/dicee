-- ============================================================================
-- persist_domain_events: Bulk insert domain events
-- ============================================================================
-- Migration: 20260105000004_rpc_persist_events
-- Purpose: Insert multiple domain events in a single transaction
-- Part of: Phase 4 - RPC-Based Persistence
--
-- Uses ON CONFLICT to handle duplicates (idempotency via event id).
--
-- Parameters:
--   p_events: Array of domain_event_input records
--
-- Returns: operation_result with count of inserted events
--
-- Example:
--   SELECT * FROM persist_domain_events(
--     ARRAY[
--       ROW('event-uuid-1', 'DiceRolled', '1.0.0', 0, 'game-uuid', 'player-uuid', 1, 1, '{"dice":[1,2,3,4,5]}')::domain_event_input,
--       ROW('event-uuid-2', 'TurnScored', '1.0.0', 1, 'game-uuid', 'player-uuid', 1, NULL, '{"category":"ones","score":3}')::domain_event_input
--     ]
--   );
-- ============================================================================

CREATE OR REPLACE FUNCTION persist_domain_events(
  p_events domain_event_input[]
)
RETURNS operation_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event domain_event_input;
  v_inserted_count INTEGER := 0;
  v_game_id UUID;
BEGIN
  -- Validate input
  IF array_length(p_events, 1) IS NULL OR array_length(p_events, 1) < 1 THEN
    RETURN ROW(true, NULL, 'No events to insert', 0)::operation_result;
  END IF;

  -- Get game_id from first event for logging
  v_game_id := p_events[1].game_id;

  -- Validate all events belong to the same game
  FOR i IN 1..array_length(p_events, 1)
  LOOP
    IF p_events[i].game_id != v_game_id THEN
      RETURN ROW(false, 'INVALID_INPUT', 'All events must belong to the same game', 0)::operation_result;
    END IF;
  END LOOP;

  -- Insert all events
  FOREACH v_event IN ARRAY p_events
  LOOP
    INSERT INTO domain_events (
      id,
      event_type,
      event_version,
      sequence_number,
      game_id,
      player_id,
      turn_number,
      roll_number,
      payload,
      timestamp
    ) VALUES (
      v_event.id,
      v_event.event_type,
      COALESCE(v_event.event_version, '1.0.0'),
      v_event.sequence_number,
      v_event.game_id,
      v_event.player_id,
      v_event.turn_number,
      v_event.roll_number,
      v_event.payload,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- Idempotency

    IF FOUND THEN
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  RAISE LOG 'persist_domain_events: Inserted % events for game %', v_inserted_count, v_game_id;

  RETURN ROW(true, NULL, NULL, v_inserted_count)::operation_result;

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN ROW(false, 'INVALID_REFERENCE', 'Game or player does not exist', 0)::operation_result;
  WHEN OTHERS THEN
    RAISE LOG 'persist_domain_events error: % %', SQLSTATE, SQLERRM;
    RETURN ROW(false, SQLSTATE, SQLERRM, 0)::operation_result;
END;
$$;

-- Grant execute to service role only
REVOKE EXECUTE ON FUNCTION persist_domain_events FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION persist_domain_events FROM anon;
REVOKE EXECUTE ON FUNCTION persist_domain_events FROM authenticated;
GRANT EXECUTE ON FUNCTION persist_domain_events TO service_role;

COMMENT ON FUNCTION persist_domain_events IS
  'Bulk inserts domain events. Idempotent via ON CONFLICT on event id.';
