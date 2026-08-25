-- restoreSetVersion (server action) fazia delete de set_tracklist_items +
-- set_blocks seguido de varios inserts sequenciais via supabase-js, sem
-- nenhuma garantia de atomicidade: se qualquer passo no meio falhasse
-- (erro de rede, constraint, timeout), o projeto ficava com a tracklist
-- apagada e nao restaurada, sem rollback. Essa funcao move a operacao
-- inteira para dentro de uma unica transacao no banco (toda funcao
-- plpgsql roda como uma transacao implicita: qualquer excecao no meio
-- desfaz tudo).
--
-- Aplicado diretamente em producao via Supabase MCP em 2026-08-24; este
-- arquivo so documenta/versiona a mudanca, ja esta refletido no banco real.
create or replace function public.restore_set_version(
  p_project_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_snapshot jsonb;
  v_block jsonb;
  v_block_id uuid;
  v_block_map jsonb := '{}'::jsonb;
  v_item jsonb;
  v_track_id uuid;
  v_block_temp_id text;
  v_position integer := 0;
  v_restored_count integer := 0;
  v_skipped_count integer := 0;
begin
  if not exists (
    select 1 from public.set_projects
    where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select snapshot into v_snapshot
  from public.set_versions
  where id = p_version_id and project_id = p_project_id;

  if v_snapshot is null then
    raise exception 'version not found';
  end if;

  delete from public.set_tracklist_items where project_id = p_project_id;
  delete from public.set_blocks where project_id = p_project_id;

  for v_block in select * from jsonb_array_elements(coalesce(v_snapshot->'blocks', '[]'::jsonb))
  loop
    insert into public.set_blocks (project_id, name)
    values (p_project_id, v_block->>'name')
    returning id into v_block_id;

    v_block_map := v_block_map || jsonb_build_object(v_block->>'tempId', v_block_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_snapshot->'items', '[]'::jsonb))
  loop
    v_track_id := (v_item->>'track_id')::uuid;

    if exists (
      select 1 from public.tracks
      where id = v_track_id and user_id = auth.uid()
    ) then
      v_position := v_position + 1;
      v_block_temp_id := v_item->>'block_temp_id';

      insert into public.set_tracklist_items (
        project_id, track_id, position, curatorial_moment, curatorial_intent, block_id
      ) values (
        p_project_id,
        v_track_id,
        v_position,
        v_item->>'curatorial_moment',
        v_item->>'curatorial_intent',
        case when v_block_temp_id is not null
          then (v_block_map->>v_block_temp_id)::uuid
          else null
        end
      );
      v_restored_count := v_restored_count + 1;
    else
      v_skipped_count := v_skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'restored_count', v_restored_count,
    'skipped_count', v_skipped_count
  );
end;
$function$;
