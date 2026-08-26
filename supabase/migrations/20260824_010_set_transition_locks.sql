-- Trava de transicao individual: um par (from_track_id, to_track_id) que
-- o auto-organize deve manter adjacente, nessa ordem, sempre que ambas as
-- tracks estiverem no pool do projeto (candidatas ou ja na tracklist).
--
-- Modelado como PAR DE TRACKS, nao como posicao atual na tracklist -- se
-- fosse por posicao ("trave o item 5 com o item 6"), um drag-and-drop ou
-- reordenacao manual depois quebraria o lock silenciosamente (ele
-- continuaria 'travado' com o que quer que tivesse ficado adjacente,
-- nao necessariamente as duas tracks que o usuario quis travar). Como par
-- de tracks, o lock e uma preferencia durável e correta independente de
-- quantas vezes a tracklist for reordenada manualmente.
--
-- unique(project_id, from_track_id) e unique(project_id, to_track_id)
-- impedem contradicoes (uma track nao pode ser obrigada a vir antes de
-- duas tracks diferentes ao mesmo tempo, nem depois de duas diferentes).
--
-- Aplicado diretamente em producao via Supabase MCP em 2026-08-24 e
-- testado (insert, constraint de contradicao, cleanup); este arquivo so
-- documenta/versiona a mudanca, ja esta refletido no banco real.
create table public.set_transition_locks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.set_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_track_id uuid not null references public.tracks(id) on delete cascade,
  to_track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint set_transition_locks_distinct check (from_track_id <> to_track_id),
  constraint set_transition_locks_from_unique unique (project_id, from_track_id),
  constraint set_transition_locks_to_unique unique (project_id, to_track_id)
);

create index set_transition_locks_project_idx on public.set_transition_locks (project_id);

alter table public.set_transition_locks enable row level security;

create policy set_transition_locks_select_own on public.set_transition_locks
  for select using (auth.uid() = user_id);

create policy set_transition_locks_insert_own on public.set_transition_locks
  for insert with check (auth.uid() = user_id);

create policy set_transition_locks_delete_own on public.set_transition_locks
  for delete using (auth.uid() = user_id);
