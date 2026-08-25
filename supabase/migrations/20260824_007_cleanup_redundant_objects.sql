-- Remove objetos redundantes encontrados em revisao de codigo (aplicado
-- diretamente em producao via Supabase MCP em 2026-08-24; este arquivo
-- so documenta/versiona a mudanca, ja esta refletido no banco real).
--
-- 1. set_candidates tinha DOIS indices unicos identicos em
--    (project_id, track_id): a constraint formal 'set_candidates_unique'
--    (mantida) e um indice solto 'set_candidates_project_track_unique_idx'
--    (removido) que nao era referenciado por nenhum FK, onConflict do
--    codigo ou constraint com nome proprio -- so custo de manutencao
--    duplicado em todo insert/update.
drop index if exists public.set_candidates_project_track_unique_idx;

-- 2. tracks tinha uma policy RLS 'tracks_own_all' (cmd ALL) com a MESMA
--    condicao (auth.uid() = user_id) das 4 policies especificas por
--    comando (select/insert/update/delete). Como policies permissivas
--    sao combinadas com OR, isso fazia o Postgres avaliar a mesma
--    subquery auth.uid() duas vezes por linha em toda query. Mantidas as
--    4 policies especificas (select/insert/update/delete), removida a
--    generica.
drop policy if exists tracks_own_all on public.tracks;
