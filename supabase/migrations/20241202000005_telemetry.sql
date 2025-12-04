-- ============================================================
-- TELEMETRY EVENTS (UX metrics, 30-day retention)
-- ============================================================

CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session tracking (works for anonymous too)
  session_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),

  -- Event data
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Context
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_telemetry_timestamp ON telemetry_events(timestamp);
CREATE INDEX idx_telemetry_session ON telemetry_events(session_id);
CREATE INDEX idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX idx_telemetry_user ON telemetry_events(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- TELEMETRY CLEANUP FUNCTION (30-day retention)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_telemetry()
RETURNS void AS $$
BEGIN
  DELETE FROM telemetry_events
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ANALYSIS CLEANUP FUNCTION (90-day retention)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_analysis()
RETURNS void AS $$
BEGIN
  DELETE FROM analysis_events
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
