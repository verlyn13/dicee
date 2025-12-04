-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Users can read public profiles or their own
CREATE POLICY "Public profiles readable"
  ON profiles FOR SELECT
  USING (is_public = true OR id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- PLAYER_STATS POLICIES
-- ============================================================

-- Stats are public (for leaderboards)
CREATE POLICY "Stats are public"
  ON player_stats FOR SELECT
  USING (true);

-- System updates only (via service role)
-- No INSERT/UPDATE policies for anon - handled by edge functions

-- ============================================================
-- GAMES POLICIES
-- ============================================================

-- Players can view games they're in, or waiting rooms
CREATE POLICY "Players can view their games"
  ON games FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM game_players WHERE game_id = id AND user_id = auth.uid())
    OR status = 'waiting'
  );

-- Host can create games
CREATE POLICY "Authenticated users can create games"
  ON games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND host_id = auth.uid());

-- Host can update game settings before start
CREATE POLICY "Host can update own game"
  ON games FOR UPDATE
  USING (host_id = auth.uid() AND status = 'waiting')
  WITH CHECK (host_id = auth.uid());

-- ============================================================
-- GAME_PLAYERS POLICIES
-- ============================================================

-- Players can view participants of their games
CREATE POLICY "View game participants"
  ON game_players FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM game_players gp WHERE gp.game_id = game_id AND gp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.status = 'waiting')
  );

-- Users can join games
CREATE POLICY "Users can join games"
  ON game_players FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own connection status
CREATE POLICY "Users can update own player record"
  ON game_players FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- ROOMS POLICIES
-- ============================================================

-- Public rooms visible to all, private only to participants
CREATE POLICY "Public rooms visible"
  ON rooms FOR SELECT
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM game_players WHERE game_id = rooms.game_id AND user_id = auth.uid())
  );

-- Users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Creator can update room settings
CREATE POLICY "Creator can update room"
  ON rooms FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Creator can delete room
CREATE POLICY "Creator can delete room"
  ON rooms FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- DOMAIN_EVENTS POLICIES
-- ============================================================

-- Participants can read game events
CREATE POLICY "Players can view game events"
  ON domain_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM game_players WHERE game_id = domain_events.game_id AND user_id = auth.uid())
  );

-- Players can insert events for their games
CREATE POLICY "Players can insert game events"
  ON domain_events FOR INSERT
  WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (SELECT 1 FROM game_players WHERE game_id = domain_events.game_id AND user_id = auth.uid())
  );

-- ============================================================
-- ANALYSIS_EVENTS POLICIES
-- ============================================================

-- Participants can read analysis of their games
CREATE POLICY "Players can view analysis events"
  ON analysis_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM domain_events de
      JOIN game_players gp ON de.game_id = gp.game_id
      WHERE de.id = source_event_id AND gp.user_id = auth.uid()
    )
  );

-- ============================================================
-- TELEMETRY_EVENTS POLICIES
-- ============================================================

-- Users can only insert telemetry, never read (privacy)
CREATE POLICY "Users can insert telemetry"
  ON telemetry_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- No SELECT policy for telemetry - admin/analytics only via service role
