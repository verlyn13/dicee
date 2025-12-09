-- Feature Flags Table
-- Supports: global enable/disable, percentage rollout, user targeting, premium gates

create table if not exists feature_flags (
  id text primary key,
  enabled boolean default false not null,
  rollout_percent int default 0 not null check (rollout_percent between 0 and 100),
  user_ids text[] default '{}' not null,
  min_games_played int default 0 not null check (min_games_played >= 0),
  premium_only boolean default false not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add comment
comment on table feature_flags is 'Feature flags for progressive rollout and A/B testing';

-- Enable RLS
alter table feature_flags enable row level security;

-- Public read access (everyone can read flags)
drop policy if exists "Public read access for feature flags" on feature_flags;
create policy "Public read access for feature flags"
  on feature_flags for select
  using (true);

-- Admin-only write access (using service role or explicit admin check)
-- For now, only service role can modify flags
drop policy if exists "Service role can manage feature flags" on feature_flags;
create policy "Service role can manage feature flags"
  on feature_flags for all
  using (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
create or replace function update_feature_flags_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists feature_flags_updated_at on feature_flags;
create trigger feature_flags_updated_at
  before update on feature_flags
  for each row
  execute function update_feature_flags_updated_at();

-- Enable realtime for flag changes (skip if already added)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feature_flags'
  ) then
    alter publication supabase_realtime add table feature_flags;
  end if;
end $$;

-- Insert initial flags with descriptions
insert into feature_flags (id, enabled, rollout_percent, description) values
  ('ev_display', true, 100, 'Show expected value indicators on scorecard'),
  ('coach_mode', true, 100, 'Enable coach mode with play suggestions'),
  ('post_game_analysis', true, 100, 'Show post-game analysis and decision review'),
  ('audio_system', true, 100, 'Enable audio feedback for game events'),
  ('enhanced_animations', true, 100, 'Enable enhanced dice physics animations'),
  ('reactions', true, 100, 'Enable emoji reactions in multiplayer'),
  ('spectator_mode', false, 0, 'Allow spectating live games'),
  ('gallery_predictions', false, 0, 'Enable spectator prediction system'),
  ('skill_rating', false, 0, 'Enable Glicko-2 skill rating for multiplayer'),
  ('advanced_stats', false, 0, 'Enable advanced statistics dashboard')
on conflict (id) do nothing;
