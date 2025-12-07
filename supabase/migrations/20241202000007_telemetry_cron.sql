-- ============================================================
-- TELEMETRY CRON JOBS
-- Schedule automated cleanup for telemetry and analysis events
-- ============================================================

-- Enable pg_cron extension (Supabase Pro feature)
-- This extension allows scheduling PostgreSQL functions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- SCHEDULE TELEMETRY CLEANUP (Daily at 3:00 AM UTC)
-- Removes events older than 30 days
-- ============================================================

SELECT cron.schedule(
  'cleanup-telemetry-events',
  '0 3 * * *',  -- Every day at 3:00 AM UTC
  $$SELECT cleanup_old_telemetry()$$
);

-- ============================================================
-- SCHEDULE ANALYSIS CLEANUP (Daily at 3:30 AM UTC)
-- Removes events older than 90 days
-- ============================================================

SELECT cron.schedule(
  'cleanup-analysis-events',
  '30 3 * * *',  -- Every day at 3:30 AM UTC
  $$SELECT cleanup_old_analysis()$$
);

-- ============================================================
-- NOTES
-- ============================================================
--
-- pg_cron is a Supabase Pro feature. For free tier projects,
-- the cleanup functions can be called manually or via an
-- external scheduler (GitHub Actions, Cloudflare Workers, etc.)
--
-- To run cleanup manually:
--   SELECT cleanup_old_telemetry();
--   SELECT cleanup_old_analysis();
--
-- To view scheduled jobs:
--   SELECT * FROM cron.job;
--
-- To unschedule a job:
--   SELECT cron.unschedule('cleanup-telemetry-events');
--
