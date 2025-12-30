-- Adds media columns to player_challenges so we can require an upload before completing.

alter table public.player_challenges
  add column if not exists media_path text,
  add column if not exists media_mime text;

