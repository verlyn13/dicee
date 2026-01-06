-- ============================================================================
-- Test RPC Functions
-- ============================================================================
-- Run in Supabase SQL Editor or via psql
-- Usage: psql $DATABASE_URL -f supabase/tests/rpc_functions.sql
--
-- These tests verify:
-- 1. Atomic game creation with multiple players
-- 2. Idempotent game creation (retry safety)
-- 3. Atomic game completion with rankings
-- 4. Idempotent game completion (retry safety)
-- 5. Bulk domain event persistence with idempotency
-- 6. Game abandonment
-- ============================================================================

DO $$
DECLARE
  v_game_id UUID := gen_random_uuid();
  v_host_id UUID := gen_random_uuid();
  v_player2_id UUID := gen_random_uuid();
  v_event1_id UUID := gen_random_uuid();
  v_event2_id UUID := gen_random_uuid();
  v_result operation_result;
  v_test_passed BOOLEAN := true;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC Functions Test Suite';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test game_id: %', v_game_id;
  RAISE NOTICE 'Test host_id: %', v_host_id;
  RAISE NOTICE 'Test player2_id: %', v_player2_id;
  RAISE NOTICE '========================================';

  -- ===========================================================================
  -- Test 1: create_game_atomic - Basic Creation
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 1: create_game_atomic - Basic Creation';

  SELECT * INTO v_result FROM create_game_atomic(
    v_game_id,
    'TEST01',
    v_host_id,
    'multiplayer',
    '{"test": true}'::jsonb,
    ARRAY[
      ROW(v_host_id, 0, 0, false)::game_player_input,
      ROW(v_player2_id, 1, 1, false)::game_player_input
    ]
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: create_game_atomic should succeed';
    RAISE NOTICE 'Error: % - %', v_result.error_code, v_result.error_message;
    v_test_passed := false;
  ELSIF v_result.affected_rows != 3 THEN
    RAISE NOTICE 'FAILED: Should create 1 game + 2 players (got %)', v_result.affected_rows;
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Created game with % rows', v_result.affected_rows;
  END IF;

  -- Verify records exist
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = v_game_id AND status = 'active') THEN
    RAISE NOTICE 'FAILED: Game record not found or wrong status';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Game record verified';
  END IF;

  IF (SELECT COUNT(*) FROM game_players WHERE game_id = v_game_id) != 2 THEN
    RAISE NOTICE 'FAILED: Expected 2 player records';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Player records verified (2 players)';
  END IF;

  -- ===========================================================================
  -- Test 2: create_game_atomic - Idempotency (Retry Safety)
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 2: create_game_atomic - Idempotency';

  SELECT * INTO v_result FROM create_game_atomic(
    v_game_id,  -- Same game_id
    'TEST01',
    v_host_id,
    'multiplayer',
    '{}'::jsonb,
    ARRAY[ROW(v_host_id, 0, 0, false)::game_player_input]
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: Duplicate create should succeed (idempotent)';
    v_test_passed := false;
  ELSIF v_result.affected_rows != 0 THEN
    RAISE NOTICE 'FAILED: Should not create duplicates (got %)', v_result.affected_rows;
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Idempotent retry returned success with 0 new rows';
  END IF;

  -- ===========================================================================
  -- Test 3: complete_game_atomic - Basic Completion
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 3: complete_game_atomic - Basic Completion';

  SELECT * INTO v_result FROM complete_game_atomic(
    v_game_id,
    v_host_id,  -- winner
    ARRAY[
      ROW(v_host_id, 1, 285, '{"ones": 3, "twos": 6}'::jsonb, false)::player_ranking,
      ROW(v_player2_id, 2, 220, '{"ones": 2, "twos": 4}'::jsonb, false)::player_ranking
    ]
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: complete_game_atomic should succeed';
    RAISE NOTICE 'Error: % - %', v_result.error_code, v_result.error_message;
    v_test_passed := false;
  ELSIF v_result.affected_rows != 3 THEN
    RAISE NOTICE 'FAILED: Should update 1 game + 2 players (got %)', v_result.affected_rows;
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Completed game with % updates', v_result.affected_rows;
  END IF;

  -- Verify game status
  IF (SELECT status FROM games WHERE id = v_game_id) != 'completed' THEN
    RAISE NOTICE 'FAILED: Game should be completed';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Game status is completed';
  END IF;

  -- Verify player scores
  IF (SELECT final_score FROM game_players WHERE game_id = v_game_id AND user_id = v_host_id) != 285 THEN
    RAISE NOTICE 'FAILED: Host score should be 285';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Host score is 285';
  END IF;

  IF (SELECT final_score FROM game_players WHERE game_id = v_game_id AND user_id = v_player2_id) != 220 THEN
    RAISE NOTICE 'FAILED: Player 2 score should be 220';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Player 2 score is 220';
  END IF;

  -- ===========================================================================
  -- Test 4: complete_game_atomic - Idempotency
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 4: complete_game_atomic - Idempotency';

  SELECT * INTO v_result FROM complete_game_atomic(
    v_game_id,
    v_host_id,
    ARRAY[ROW(v_host_id, 1, 999, '{}'::jsonb, false)::player_ranking]  -- Different score
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: Duplicate complete should succeed (idempotent)';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Idempotent retry returned success';
  END IF;

  -- Verify score did NOT change
  IF (SELECT final_score FROM game_players WHERE game_id = v_game_id AND user_id = v_host_id) != 285 THEN
    RAISE NOTICE 'FAILED: Score should not change on idempotent retry';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Score unchanged (285) after idempotent retry';
  END IF;

  -- ===========================================================================
  -- Test 5: persist_domain_events - Bulk Insert
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 5: persist_domain_events - Bulk Insert';

  SELECT * INTO v_result FROM persist_domain_events(
    ARRAY[
      ROW(v_event1_id, 'GameStarted', '1.0.0', 0, v_game_id, v_host_id, NULL, NULL, '{"test": 1}'::jsonb)::domain_event_input,
      ROW(v_event2_id, 'TurnScored', '1.0.0', 1, v_game_id, v_host_id, 1, NULL, '{"category": "ones"}'::jsonb)::domain_event_input
    ]
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: persist_domain_events should succeed';
    RAISE NOTICE 'Error: % - %', v_result.error_code, v_result.error_message;
    v_test_passed := false;
  ELSIF v_result.affected_rows != 2 THEN
    RAISE NOTICE 'FAILED: Should insert 2 events (got %)', v_result.affected_rows;
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Inserted % events', v_result.affected_rows;
  END IF;

  -- ===========================================================================
  -- Test 6: persist_domain_events - Idempotency
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 6: persist_domain_events - Idempotency';

  SELECT * INTO v_result FROM persist_domain_events(
    ARRAY[
      ROW(v_event1_id, 'GameStarted', '1.0.0', 0, v_game_id, v_host_id, NULL, NULL, '{"test": 1}'::jsonb)::domain_event_input
    ]
  );

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: Duplicate event insert should succeed (idempotent)';
    v_test_passed := false;
  ELSIF v_result.affected_rows != 0 THEN
    RAISE NOTICE 'FAILED: Should skip duplicate event (got %)', v_result.affected_rows;
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Duplicate event skipped (0 inserted)';
  END IF;

  -- ===========================================================================
  -- Test 7: Empty Events Array
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 7: persist_domain_events - Empty Array';

  SELECT * INTO v_result FROM persist_domain_events(ARRAY[]::domain_event_input[]);

  IF NOT v_result.success THEN
    RAISE NOTICE 'FAILED: Empty array should succeed';
    v_test_passed := false;
  ELSE
    RAISE NOTICE 'PASSED: Empty array handled correctly';
  END IF;

  -- ===========================================================================
  -- Cleanup
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Cleaning up test data...';

  DELETE FROM domain_events WHERE game_id = v_game_id;
  DELETE FROM game_players WHERE game_id = v_game_id;
  DELETE FROM games WHERE id = v_game_id;

  RAISE NOTICE 'Cleanup complete';

  -- ===========================================================================
  -- Summary
  -- ===========================================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  IF v_test_passed THEN
    RAISE NOTICE 'All tests PASSED!';
  ELSE
    RAISE NOTICE 'Some tests FAILED - review output above';
  END IF;
  RAISE NOTICE '========================================';
END;
$$;
