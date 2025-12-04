-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,  -- nullable for anonymous users
  display_name TEXT,
  bio TEXT,
  avatar_seed TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  avatar_style TEXT NOT NULL DEFAULT 'identicon',

  -- Skill rating (Glicko-2 system)
  skill_rating DECIMAL(7,2) NOT NULL DEFAULT 1500.00,
  rating_deviation DECIMAL(6,2) NOT NULL DEFAULT 350.00,
  rating_volatility DECIMAL(5,4) NOT NULL DEFAULT 0.06,

  -- Achievements
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Account status
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX idx_profiles_skill_rating ON profiles(skill_rating DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, is_anonymous)
  VALUES (NEW.id, COALESCE(NEW.is_anonymous, false));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PLAYER STATISTICS (aggregated, updated after each game)
-- ============================================================

CREATE TABLE player_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Game counts
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_completed INTEGER NOT NULL DEFAULT 0,

  -- Scores
  total_score BIGINT NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  avg_score DECIMAL(6,2) NOT NULL DEFAULT 0,

  -- Special achievements
  yahtzees_rolled INTEGER NOT NULL DEFAULT 0,
  bonus_yahtzees INTEGER NOT NULL DEFAULT 0,
  upper_bonuses INTEGER NOT NULL DEFAULT 0,

  -- Category stats (JSONB for flexibility)
  category_stats JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Decision quality (from telemetry)
  optimal_decisions INTEGER NOT NULL DEFAULT 0,
  total_decisions INTEGER NOT NULL DEFAULT 0,
  avg_ev_loss DECIMAL(5,2) NOT NULL DEFAULT 0,

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
