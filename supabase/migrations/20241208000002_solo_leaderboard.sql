-- Solo Leaderboard Table
-- Tracks high scores from solo games for time-based leaderboards

create table if not exists solo_leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score >= 0),
  efficiency decimal(5,4) default 0,
  yahtzee_count int default 0,
  upper_bonus boolean default false,
  game_id uuid references games(id) on delete set null,
  created_at timestamptz default now() not null,

  -- Composite index for efficient time-based queries
  constraint solo_leaderboard_score_positive check (score >= 0)
);

-- Indexes for common query patterns
create index solo_leaderboard_score_desc on solo_leaderboard(score desc);
create index solo_leaderboard_created_at on solo_leaderboard(created_at desc);
create index solo_leaderboard_user_week on solo_leaderboard(user_id, created_at desc);
-- Composite index for time-based leaderboard queries (score within date range)
create index solo_leaderboard_time_score on solo_leaderboard(created_at desc, score desc);

-- Add comment
comment on table solo_leaderboard is 'High scores from solo games for leaderboard display';

-- Enable RLS
alter table solo_leaderboard enable row level security;

-- Everyone can read leaderboard entries
create policy "Public read access for solo leaderboard"
  on solo_leaderboard for select
  using (true);

-- Users can insert their own scores
create policy "Users can insert own scores"
  on solo_leaderboard for insert
  with check (auth.uid() = user_id);

-- Users can delete their own scores (optional)
create policy "Users can delete own scores"
  on solo_leaderboard for delete
  using (auth.uid() = user_id);

-- Function to get daily leaderboard with rank
create or replace function get_daily_leaderboard(limit_count int default 100)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_seed text,
  score int,
  efficiency decimal,
  created_at timestamptz
) as $$
begin
  return query
  select
    row_number() over (order by sl.score desc, sl.created_at asc) as rank,
    sl.user_id,
    p.display_name,
    p.avatar_seed,
    sl.score,
    sl.efficiency,
    sl.created_at
  from solo_leaderboard sl
  join profiles p on p.id = sl.user_id
  where sl.created_at > now() - interval '1 day'
  order by sl.score desc, sl.created_at asc
  limit limit_count;
end;
$$ language plpgsql stable;

-- Function to get weekly leaderboard with rank
create or replace function get_weekly_leaderboard(limit_count int default 100)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_seed text,
  score int,
  efficiency decimal,
  created_at timestamptz
) as $$
begin
  return query
  select
    row_number() over (order by sl.score desc, sl.created_at asc) as rank,
    sl.user_id,
    p.display_name,
    p.avatar_seed,
    sl.score,
    sl.efficiency,
    sl.created_at
  from solo_leaderboard sl
  join profiles p on p.id = sl.user_id
  where sl.created_at > now() - interval '7 days'
  order by sl.score desc, sl.created_at asc
  limit limit_count;
end;
$$ language plpgsql stable;

-- Function to get all-time leaderboard (best score per user)
create or replace function get_alltime_leaderboard(limit_count int default 100)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_seed text,
  score int,
  efficiency decimal,
  created_at timestamptz
) as $$
begin
  return query
  with best_scores as (
    select distinct on (sl.user_id)
      sl.user_id,
      sl.score,
      sl.efficiency,
      sl.created_at
    from solo_leaderboard sl
    order by sl.user_id, sl.score desc, sl.created_at asc
  )
  select
    row_number() over (order by bs.score desc, bs.created_at asc) as rank,
    bs.user_id,
    p.display_name,
    p.avatar_seed,
    bs.score,
    bs.efficiency,
    bs.created_at
  from best_scores bs
  join profiles p on p.id = bs.user_id
  order by bs.score desc, bs.created_at asc
  limit limit_count;
end;
$$ language plpgsql stable;

-- Function to get user's best scores
create or replace function get_user_best_scores(target_user_id uuid, limit_count int default 10)
returns table (
  score int,
  efficiency decimal,
  yahtzee_count int,
  upper_bonus boolean,
  created_at timestamptz
) as $$
begin
  return query
  select
    sl.score,
    sl.efficiency,
    sl.yahtzee_count,
    sl.upper_bonus,
    sl.created_at
  from solo_leaderboard sl
  where sl.user_id = target_user_id
  order by sl.score desc
  limit limit_count;
end;
$$ language plpgsql stable;
