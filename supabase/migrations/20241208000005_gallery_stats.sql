-- Gallery Stats and Achievements (D9)
-- Persistent storage for spectator engagement data

-- Gallery stats table
CREATE TABLE IF NOT EXISTS public.gallery_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_seed TEXT,

    -- Points
    total_points INTEGER NOT NULL DEFAULT 0,
    prediction_points INTEGER NOT NULL DEFAULT 0,
    streak_bonus_points INTEGER NOT NULL DEFAULT 0,
    exact_score_points INTEGER NOT NULL DEFAULT 0,
    reaction_points INTEGER NOT NULL DEFAULT 0,
    kibitz_points INTEGER NOT NULL DEFAULT 0,
    chat_points INTEGER NOT NULL DEFAULT 0,
    backed_winner_points INTEGER NOT NULL DEFAULT 0,
    loyalty_bonus_points INTEGER NOT NULL DEFAULT 0,

    -- Prediction stats
    total_predictions INTEGER NOT NULL DEFAULT 0,
    correct_predictions INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    exact_predictions INTEGER NOT NULL DEFAULT 0,
    yahtzee_predictions INTEGER NOT NULL DEFAULT 0,

    -- Engagement stats
    games_watched INTEGER NOT NULL DEFAULT 0,
    rooms_visited INTEGER NOT NULL DEFAULT 0,
    reactions_given INTEGER NOT NULL DEFAULT 0,
    kibitz_votes INTEGER NOT NULL DEFAULT 0,
    chat_messages INTEGER NOT NULL DEFAULT 0,

    -- Backing stats
    total_backings INTEGER NOT NULL DEFAULT 0,
    backed_winner_count INTEGER NOT NULL DEFAULT 0,
    current_backing_streak INTEGER NOT NULL DEFAULT 0,
    best_backing_streak INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gallery achievements table
CREATE TABLE IF NOT EXISTS public.gallery_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, achievement_id)
);

-- Gallery leaderboard view (weekly)
CREATE OR REPLACE VIEW public.gallery_leaderboard_weekly AS
SELECT
    user_id,
    display_name,
    avatar_seed,
    total_points,
    CASE
        WHEN total_predictions > 0
        THEN ROUND((correct_predictions::DECIMAL / total_predictions) * 100, 1)
        ELSE 0
    END AS prediction_accuracy,
    CONCAT(backed_winner_count, '/', total_backings) AS win_pick_ratio,
    (SELECT COUNT(*) FROM public.gallery_achievements a
     WHERE a.user_id = s.user_id AND a.unlocked = TRUE) AS achievement_count,
    RANK() OVER (ORDER BY total_points DESC) AS rank
FROM public.gallery_stats s
WHERE updated_at > NOW() - INTERVAL '7 days'
ORDER BY total_points DESC
LIMIT 100;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_stats_total_points ON public.gallery_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_stats_updated_at ON public.gallery_stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_gallery_achievements_user ON public.gallery_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_achievements_unlocked ON public.gallery_achievements(user_id, unlocked) WHERE unlocked = TRUE;

-- RLS policies
ALTER TABLE public.gallery_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can read gallery stats (leaderboard)
CREATE POLICY "Gallery stats are viewable by everyone"
    ON public.gallery_stats FOR SELECT
    USING (true);

-- Users can only update their own stats (via service role)
CREATE POLICY "Users can update their own gallery stats"
    ON public.gallery_stats FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can insert their own stats
CREATE POLICY "Users can insert their own gallery stats"
    ON public.gallery_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Achievements are viewable by everyone"
    ON public.gallery_achievements FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own achievements"
    ON public.gallery_achievements FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
    ON public.gallery_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_gallery_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gallery_stats_timestamp
    BEFORE UPDATE ON public.gallery_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_gallery_stats_updated_at();

CREATE TRIGGER update_gallery_achievements_timestamp
    BEFORE UPDATE ON public.gallery_achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_gallery_stats_updated_at();

-- Function to award points (callable from edge function or direct)
CREATE OR REPLACE FUNCTION award_gallery_points(
    p_user_id UUID,
    p_display_name TEXT,
    p_avatar_seed TEXT,
    p_prediction_points INTEGER DEFAULT 0,
    p_streak_bonus INTEGER DEFAULT 0,
    p_exact_score_points INTEGER DEFAULT 0,
    p_reaction_points INTEGER DEFAULT 0,
    p_kibitz_points INTEGER DEFAULT 0,
    p_chat_points INTEGER DEFAULT 0,
    p_backed_winner INTEGER DEFAULT 0,
    p_loyalty_bonus INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    v_total := p_prediction_points + p_streak_bonus + p_exact_score_points +
               p_reaction_points + p_kibitz_points + p_chat_points +
               p_backed_winner + p_loyalty_bonus;

    INSERT INTO public.gallery_stats (
        user_id, display_name, avatar_seed,
        total_points, prediction_points, streak_bonus_points, exact_score_points,
        reaction_points, kibitz_points, chat_points,
        backed_winner_points, loyalty_bonus_points
    ) VALUES (
        p_user_id, p_display_name, p_avatar_seed,
        v_total, p_prediction_points, p_streak_bonus, p_exact_score_points,
        p_reaction_points, p_kibitz_points, p_chat_points,
        p_backed_winner, p_loyalty_bonus
    )
    ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_seed = COALESCE(EXCLUDED.avatar_seed, gallery_stats.avatar_seed),
        total_points = gallery_stats.total_points + v_total,
        prediction_points = gallery_stats.prediction_points + p_prediction_points,
        streak_bonus_points = gallery_stats.streak_bonus_points + p_streak_bonus,
        exact_score_points = gallery_stats.exact_score_points + p_exact_score_points,
        reaction_points = gallery_stats.reaction_points + p_reaction_points,
        kibitz_points = gallery_stats.kibitz_points + p_kibitz_points,
        chat_points = gallery_stats.chat_points + p_chat_points,
        backed_winner_points = gallery_stats.backed_winner_points + p_backed_winner,
        loyalty_bonus_points = gallery_stats.loyalty_bonus_points + p_loyalty_bonus;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlock achievement
CREATE OR REPLACE FUNCTION unlock_gallery_achievement(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_progress INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
    v_already_unlocked BOOLEAN;
BEGIN
    SELECT unlocked INTO v_already_unlocked
    FROM public.gallery_achievements
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id;

    IF v_already_unlocked THEN
        RETURN FALSE; -- Already unlocked
    END IF;

    INSERT INTO public.gallery_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
    VALUES (p_user_id, p_achievement_id, p_progress, TRUE, NOW())
    ON CONFLICT (user_id, achievement_id) DO UPDATE SET
        progress = EXCLUDED.progress,
        unlocked = TRUE,
        unlocked_at = COALESCE(gallery_achievements.unlocked_at, NOW());

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update achievement progress
CREATE OR REPLACE FUNCTION update_achievement_progress(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_progress INTEGER
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.gallery_achievements (user_id, achievement_id, progress)
    VALUES (p_user_id, p_achievement_id, p_progress)
    ON CONFLICT (user_id, achievement_id) DO UPDATE SET
        progress = EXCLUDED.progress
    WHERE gallery_achievements.unlocked = FALSE; -- Don't update if already unlocked
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
