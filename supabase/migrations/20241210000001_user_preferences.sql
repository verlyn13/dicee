-- Migration: Add preferences column to profiles
-- Schema: packages/shared/src/validation/preferences.ts

-- Add preferences JSONB column with empty object default
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add descriptive comment
COMMENT ON COLUMN public.profiles.preferences IS 
  'User preferences JSON. Schema: packages/shared/src/validation/preferences.ts';
