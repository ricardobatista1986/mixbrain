-- Sub-indicadores extras (features de audio no padrao Spotify, escala
-- 0.0-1.0) que o CSV ja detectava como cabecalho (Dance, Acoustic,
-- Instrumental, Valence, Speech) mas nunca tinha coluna pra guardar nem
-- entrava no modelo de score. Nullable -- nem toda fonte/CSV traz esses
-- dados, e o calculo do score ja trata ausencia graciosamente (fator
-- "missing", reponderado sobre o que existir).
--
-- Aplicado diretamente em producao via Supabase MCP em 2026-08-24; este
-- arquivo so documenta/versiona a mudanca, ja esta refletido no banco real.
alter table public.tracks
  add column if not exists danceability numeric(4,3) check (danceability is null or (danceability >= 0 and danceability <= 1)),
  add column if not exists valence numeric(4,3) check (valence is null or (valence >= 0 and valence <= 1)),
  add column if not exists instrumentalness numeric(4,3) check (instrumentalness is null or (instrumentalness >= 0 and instrumentalness <= 1)),
  add column if not exists speechiness numeric(4,3) check (speechiness is null or (speechiness >= 0 and speechiness <= 1)),
  add column if not exists acousticness numeric(4,3) check (acousticness is null or (acousticness >= 0 and acousticness <= 1));
