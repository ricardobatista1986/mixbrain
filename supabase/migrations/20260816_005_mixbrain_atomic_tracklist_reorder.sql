-- MixBrain: reordenação atômica de tracklist.
--
-- Corrige um bug real de produção: a reordenação de tracklist (usada por
-- moveEntityUp/Down, removeFromTracklist, drag-and-drop e "Gerar ordem
-- automática") era feita via múltiplas chamadas UPDATE sequenciais do lado
-- da aplicação — primeiro jogando as posições atuais para negativo
-- (necessário por causa do UNIQUE(project_id, position)), depois para a
-- posição final. Se qualquer chamada no meio do caminho falhasse (ex.:
-- colisão de posição por corrida entre requisições, erro de rede), a
-- tracklist ficava permanentemente com posições negativas — sem nenhuma
-- forma de recuperação automática. Foi exatamente o que aconteceu em
-- produção: um projeto ficou com 10 itens travados em posições -1 a -10.
--
-- A correção move a lógica para dentro do banco, como função PL/pgSQL:
-- todas as atualizações de uma reordenação passam a rodar dentro de UMA
-- ÚNICA transação. Se qualquer parte falhar, o Postgres desfaz tudo
-- automaticamente — a tracklist nunca mais fica com posições inválidas
-- pela metade.
--
-- Aplicado diretamente em produção via Supabase antes deste arquivo ser
-- commitado; este arquivo documenta a mudança para o histórico de
-- migrations não ficar defasado (mesmo padrão das migrations 003/004).
-- Idempotente (create or replace function).

create or replace function public.reorder_tracklist_items(
  p_project_id uuid,
  p_positions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.set_projects
    where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  -- fase 1: posições negativas temporárias e únicas.
  with items as (
    select (elem->>'id')::uuid as id, row_number() over () as rn
    from jsonb_array_elements(p_positions) as elem
  )
  update public.set_tracklist_items t
  set position = -items.rn
  from items
  where t.id = items.id and t.project_id = p_project_id;

  -- fase 2: posição final de verdade.
  with items as (
    select (elem->>'id')::uuid as id, (elem->>'position')::int as pos
    from jsonb_array_elements(p_positions) as elem
  )
  update public.set_tracklist_items t
  set position = items.pos
  from items
  where t.id = items.id and t.project_id = p_project_id;
end;
$$;

grant execute on function public.reorder_tracklist_items(uuid, jsonb) to authenticated;

-- Mesma lógica, cobrindo também a inserção de candidatas novas aprovadas
-- na hora (usado pelo "Gerar ordem automática"): as novas entram primeiro
-- em posições negativas seguras, depois tudo (novas + existentes) é
-- movido junto para a posição final, na mesma transação.
create or replace function public.auto_organize_tracklist(
  p_project_id uuid,
  p_new_track_ids uuid[],
  p_final_order jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_next_neg int;
  v_new_item record;
  v_new_id_map jsonb := '{}'::jsonb;
begin
  select user_id into v_user_id from public.set_projects
  where id = p_project_id and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  with existing as (
    select id, row_number() over () as rn
    from public.set_tracklist_items
    where project_id = p_project_id
  )
  update public.set_tracklist_items t
  set position = -existing.rn
  from existing
  where t.id = existing.id;

  v_next_neg := -(select count(*) from public.set_tracklist_items where project_id = p_project_id) - 1;

  for v_new_item in
    select unnest as track_id from unnest(p_new_track_ids)
  loop
    declare
      v_new_row_id uuid;
    begin
      insert into public.set_tracklist_items (project_id, track_id, position)
      values (p_project_id, v_new_item.track_id, v_next_neg)
      returning id into v_new_row_id;

      v_new_id_map := v_new_id_map || jsonb_build_object(v_new_item.track_id::text, v_new_row_id::text);
      v_next_neg := v_next_neg - 1;
    end;
  end loop;

  with final_items as (
    select
      case
        when (elem->>'kind') = 'existing' then (elem->>'id')::uuid
        else (v_new_id_map->>(elem->>'track_id'))::uuid
      end as item_id,
      (row_number() over ())::int as pos
    from jsonb_array_elements(p_final_order) as elem
  )
  update public.set_tracklist_items t
  set position = final_items.pos
  from final_items
  where t.id = final_items.item_id and t.project_id = p_project_id;
end;
$$;

grant execute on function public.auto_organize_tracklist(uuid, uuid[], jsonb) to authenticated;
