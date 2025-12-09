-- Rename Yahtzee columns to Dicee
-- Part of trademark-safe rebranding from Yahtzee to Dicee

-- =============================================================================
-- Rename columns in player_stats table
-- =============================================================================

alter table player_stats
  rename column yahtzees_rolled to dicees_rolled;

alter table player_stats
  rename column bonus_yahtzees to bonus_dicees;

comment on column player_stats.dicees_rolled is 'Total dicees (five of a kind) rolled across all games';
comment on column player_stats.bonus_dicees is 'Total bonus dicees scored (100 pts each after first dicee)';

-- =============================================================================
-- Rename column in solo_leaderboard table
-- =============================================================================

alter table solo_leaderboard
  rename column yahtzee_count to dicee_count;

comment on column solo_leaderboard.dicee_count is 'Number of dicees scored in this game';

-- =============================================================================
-- Update get_user_best_scores function to use new column name
-- Must DROP first since return type is changing
-- =============================================================================

drop function if exists get_user_best_scores(uuid, int);

create function get_user_best_scores(target_user_id uuid, limit_count int default 10)
returns table (
  score int,
  efficiency decimal,
  dicee_count int,
  upper_bonus boolean,
  created_at timestamptz
) as $$
begin
  return query
  select
    sl.score,
    sl.efficiency,
    sl.dicee_count,
    sl.upper_bonus,
    sl.created_at
  from solo_leaderboard sl
  where sl.user_id = target_user_id
  order by sl.score desc
  limit limit_count;
end;
$$ language plpgsql stable;

comment on function get_user_best_scores is 'Get a user''s best solo game scores with dicee counts';
