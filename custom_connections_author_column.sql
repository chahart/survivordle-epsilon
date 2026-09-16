-- Adds an optional author name to custom Connections puzzles.
-- Run this in the Supabase SQL Editor.

alter table custom_connections_puzzles
  add column if not exists author text;
