-- ============================================================
-- ROOMS (lobby system for multiplayer)
-- ============================================================

CREATE TABLE rooms (
  code TEXT PRIMARY KEY,  -- 6-char alphanumeric (e.g., ABC123)
  game_id UUID UNIQUE REFERENCES games(id) ON DELETE CASCADE,

  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT false,

  -- Capacity
  max_players SMALLINT NOT NULL DEFAULT 4,
  current_players SMALLINT NOT NULL DEFAULT 0,

  -- Creator
  created_by UUID NOT NULL REFERENCES profiles(id),

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours',

  CONSTRAINT valid_player_count CHECK (current_players <= max_players),
  CONSTRAINT valid_max_players CHECK (max_players BETWEEN 2 AND 6)
);

CREATE INDEX idx_rooms_public ON rooms(is_public, current_players)
  WHERE is_public = true;
CREATE INDEX idx_rooms_expires ON rooms(expires_at);

-- ============================================================
-- ROOM CLEANUP FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
  -- Delete expired rooms (cascade deletes associated games)
  DELETE FROM rooms WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROOM CODE GENERATION HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- No 0/O, 1/I/L
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
