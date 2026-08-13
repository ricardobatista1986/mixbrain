-- MixBrain: suporte a arquivamento de projeto.
-- Aplicado diretamente em produção via Supabase SQL Editor; este arquivo só
-- documenta a mudança para o histórico de migrations não ficar defasado
-- (mesmo padrão da migration 003 de reconciliação). Idempotente.

alter table public.set_projects
  add column if not exists archived_at timestamptz;

create index if not exists set_projects_user_archived_idx
  on public.set_projects(user_id, archived_at);
