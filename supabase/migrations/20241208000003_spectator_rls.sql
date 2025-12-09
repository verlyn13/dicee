-- ============================================================
-- SPECTATOR MODE RLS POLICIES
-- ============================================================
-- Allows spectators to view games where spectators are allowed.
-- Spectators can read game state but cannot modify anything.

-- ============================================================
-- ADD allow_spectators COLUMN TO ROOMS (must be first)
-- ============================================================

-- Add allow_spectators column to rooms table for spectator discovery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'allow_spectators'
  ) THEN
    ALTER TABLE rooms ADD COLUMN allow_spectators BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- UPDATE GAMES POLICY - Allow spectators to view public games
-- ============================================================

-- Drop and recreate games select policy to include spectator access
DROP POLICY IF EXISTS "Players can view their games" ON games;

CREATE POLICY "Players and spectators can view games"
  ON games FOR SELECT
  USING (
    -- Participants can always see their games
    EXISTS (SELECT 1 FROM game_players WHERE game_id = id AND user_id = auth.uid())
    -- Anyone can see waiting rooms
    OR status = 'waiting'
    -- Spectators can view games where spectators are allowed
    OR (
      (settings->>'allowSpectators')::boolean = true
      AND status IN ('playing', 'completed')
    )
  );

-- ============================================================
-- UPDATE GAME_PLAYERS POLICY - Allow spectators to view
-- ============================================================

DROP POLICY IF EXISTS "View game participants" ON game_players;

CREATE POLICY "View game participants"
  ON game_players FOR SELECT
  USING (
    -- Participants can view their own games
    EXISTS (SELECT 1 FROM game_players gp WHERE gp.game_id = game_id AND gp.user_id = auth.uid())
    -- Anyone can view waiting room participants
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.status = 'waiting')
    -- Spectators can view players in spectator-enabled games
    OR EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = game_id
      AND (g.settings->>'allowSpectators')::boolean = true
      AND g.status IN ('playing', 'completed')
    )
  );

-- ============================================================
-- UPDATE DOMAIN_EVENTS POLICY - Allow spectators to view events
-- ============================================================

DROP POLICY IF EXISTS "Players can view game events" ON domain_events;

CREATE POLICY "Players and spectators can view game events"
  ON domain_events FOR SELECT
  USING (
    -- Participants can always see their game events
    EXISTS (SELECT 1 FROM game_players WHERE game_id = domain_events.game_id AND user_id = auth.uid())
    -- Spectators can view events in spectator-enabled games
    OR EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = domain_events.game_id
      AND (g.settings->>'allowSpectators')::boolean = true
      AND g.status IN ('playing', 'completed')
    )
  );

-- ============================================================
-- UPDATE ROOMS POLICY - Allow spectators to view spectator-enabled rooms
-- ============================================================

DROP POLICY IF EXISTS "Public rooms visible" ON rooms;

CREATE POLICY "Public and spectator rooms visible"
  ON rooms FOR SELECT
  USING (
    -- Public rooms visible to all
    is_public = true
    -- Creator can always see their rooms
    OR created_by = auth.uid()
    -- Participants can see their rooms
    OR EXISTS (SELECT 1 FROM game_players WHERE game_id = rooms.game_id AND user_id = auth.uid())
    -- Spectator-enabled rooms visible to all authenticated users
    OR (
      allow_spectators = true
      AND auth.uid() IS NOT NULL
    )
  );

-- Create index for spectator-enabled room queries
CREATE INDEX IF NOT EXISTS idx_rooms_spectator_enabled
  ON rooms (allow_spectators) WHERE allow_spectators = true;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON POLICY "Players and spectators can view games" ON games IS
  'Allows spectators to view games that have spectators enabled. Spectators cannot modify game state.';

COMMENT ON POLICY "Players and spectators can view game events" ON domain_events IS
  'Allows spectators to view game events (dice rolls, scores) for spectator-enabled games.';
