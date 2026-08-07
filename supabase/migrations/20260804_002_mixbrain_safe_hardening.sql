-- MixBrain: hardening seguro para a importação CSV.
-- Execute UMA vez no Supabase SQL Editor.
-- Este script não apaga dados nem altera registros existentes.

-- Impede que a mesma track seja inserida mais de uma vez
-- como candidata no mesmo projeto.
create unique index if not exists set_candidates_project_track_unique_idx
  on public.set_candidates (project_id, track_id);

-- Acelera a consulta usada para encontrar tracks já existentes
-- na biblioteca durante a importação CSV.
create index if not exists tracks_user_title_artist_idx
  on public.tracks (user_id, title, artist);

-- Acelera a consulta da próxima posição das candidatas no projeto.
create index if not exists set_candidates_project_user_order_idx
  on public.set_candidates (project_id, user_id, sort_order);
