-- MixBrain: reconciliação de migrations com o schema REAL do banco.
--
-- Contexto: em algum momento entre a migration 001 e o estado atual de
-- produção, o schema foi alterado diretamente (Supabase Studio / SQL
-- editor) sem gerar uma migration correspondente. O código da aplicação já
-- assume esse schema divergente (ex.: tracks.bpm/energy/musical_key/mood
-- direto na tabela tracks, em vez de em track_features; set_candidates com
-- user_id e sort_order). Esta migration só formaliza o que já existe em
-- produção, para os arquivos de migration pararem de mentir sobre o schema
-- real. Ela é idempotente e segura: só adiciona o que estiver faltando,
-- nunca remove ou altera tipo de coluna existente.
--
-- Execute no Supabase SQL Editor. Rodar em um banco que já tem essas
-- colunas é um no-op (todas as instruções usam IF NOT EXISTS).

-- ---------------------------------------------------------------------
-- tracks: colunas de atributos musicais direto na tabela principal
-- (a migration 001 original as colocava em track_features; a aplicação
-- não usa track_features, lê/grava tudo em tracks).
-- ---------------------------------------------------------------------

alter table public.tracks
  add column if not exists bpm numeric(6,2),
  add column if not exists musical_key text,
  add column if not exists energy integer,
  add column if not exists mood text,
  add column if not exists source text,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tracks_bpm_positive'
  ) then
    alter table public.tracks
      add constraint tracks_bpm_positive check (bpm is null or bpm > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tracks_energy_range'
  ) then
    alter table public.tracks
      add constraint tracks_energy_range check (energy is null or (energy >= 1 and energy <= 10));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- set_candidates: user_id (ownership direto, usado pelas policies e pela
-- aplicação) e sort_order (ordem de exibição das candidatas).
-- ---------------------------------------------------------------------

alter table public.set_candidates
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'set_candidates_sort_order_positive'
  ) then
    alter table public.set_candidates
      add constraint set_candidates_sort_order_positive check (sort_order >= 0);
  end if;
end $$;

create index if not exists set_candidates_user_id_idx on public.set_candidates(user_id);

-- ---------------------------------------------------------------------
-- Nota informativa (não corrigido automaticamente aqui):
--
-- set_candidates.status em produção é `text` com
-- CHECK (status IN ('candidate','approved','rejected')), não o enum
-- public.track_candidate_status criado pela migration 001
-- ('candidate','active','suggested_reserve','reserved','required',
-- 'excluded','bridge'). A aplicação hoje só usa 'candidate' e depende do
-- registro sumir da fila quando aprovado (via presença em
-- set_tracklist_items), então esse desvio não quebra nada em uso atual —
-- mas se algum dia quiser reativar os status intermediários do plano
-- original (suggested_reserve, reserved, etc.), será necessário decidir
-- entre manter `text` com CHECK ampliado ou migrar para o enum de fato,
-- com um ALTER TYPE explícito e cuidado com dados existentes.
-- ---------------------------------------------------------------------
