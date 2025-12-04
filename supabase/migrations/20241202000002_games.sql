-- ============================================================
-- GAMES
-- ============================================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT,  -- nullable (solo games don't need room)

  -- Status
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'starting', 'active', 'completed', 'abandoned')),

  -- Configuration
  game_mode TEXT NOT NULL DEFAULT 'multiplayer'
    CHECK (game_mode IN ('solo', 'multiplayer', 'tutorial')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Host/creator
  host_id UUID REFERENCES profiles(id),

  -- Results
  winner_id UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed')
  )
);

CREATE INDEX idx_games_status ON games(status) WHERE status IN ('waiting', 'active');
CREATE INDEX idx_games_room_code ON games(room_code) WHERE room_code IS NOT NULL;
CREATE INDEX idx_games_host ON games(host_id);

-- ============================================================
-- GAME PLAYERS (join table with game-specific data)
-- ============================================================

CREATE TABLE game_players (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Position
  seat_number SMALLINT NOT NULL,
  turn_order SMALLINT NOT NULL,

  -- Final state
  final_score INTEGER,
  final_rank SMALLINT,
  scorecard JSONB,  -- final scorecard snapshot

  -- Status
  is_connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,

  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX idx_game_players_user ON game_players(user_id);
