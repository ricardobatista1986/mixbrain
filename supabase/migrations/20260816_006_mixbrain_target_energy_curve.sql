-- MixBrain: curva de energia alvo por projeto.
-- Aplicado diretamente em produção via Supabase; este arquivo documenta a
-- mudança para o histórico de migrations não ficar defasado (mesmo padrão
-- das migrations 003/004/005). Idempotente.

alter table public.set_projects
  add column if not exists target_energy_curve jsonb;

comment on column public.set_projects.target_energy_curve is
  'Array de 5 pontos (energia 1-10 ou null) nas marcas 0%/25%/50%/75%/100% do set. Usado por auto_organize_tracklist para guiar a ordenacao automatica, alem do score par-a-par.';
