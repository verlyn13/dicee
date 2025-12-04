-- ============================================================
-- DOMAIN EVENTS (permanent game history - event sourcing)
-- ============================================================

CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identity
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT '1.0.0',
  sequence_number BIGINT NOT NULL,

  -- Context
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  turn_number SMALLINT,
  roll_number SMALLINT,

  -- Payload
  payload JSONB NOT NULL,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uniqueness constraint for event ordering
  CONSTRAINT unique_game_sequence UNIQUE (game_id, sequence_number)
);

CREATE INDEX idx_domain_events_game ON domain_events(game_id, sequence_number);
CREATE INDEX idx_domain_events_type ON domain_events(event_type);
CREATE INDEX idx_domain_events_player ON domain_events(player_id);
CREATE INDEX idx_domain_events_timestamp ON domain_events(timestamp);

-- ============================================================
-- ANALYSIS EVENTS (computational results, 90-day retention)
-- ============================================================

CREATE TABLE analysis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID REFERENCES domain_events(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_events_source ON analysis_events(source_event_id);
CREATE INDEX idx_analysis_events_type ON analysis_events(event_type);
CREATE INDEX idx_analysis_events_timestamp ON analysis_events(timestamp);
