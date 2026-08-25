-- Corrige bug de importacao CSV: o pre-check de duplicata em JS
-- (normalizeForMatching) e a constraint unica no banco
-- (tracks_user_normalized_identity_unique) usam motores de normalizacao
-- de texto diferentes (JS Unicode vs regex do Postgres) que podem
-- divergir em casos de borda -- resultando em "duplicate key value
-- violates unique constraint" mesmo quando o JS achou que a track era
-- nova. Em vez de tentar manter as duas normalizacoes sincronizadas
-- para sempre (fragil, sempre pode divergir de novo com outro
-- caractere), esta funcao move a resolucao de identidade pra dentro do
-- banco via ON CONFLICT usando a MESMA expressao do indice unico --
-- a constraint vira a autoridade sobre si mesma, eliminando essa classe
-- inteira de bug.
--
-- Aplicado diretamente em producao via Supabase MCP em 2026-08-24 e
-- testado (insert + duplicata exata + duplicata so apos normalizar +
-- track nova, dados de teste removidos em seguida); este arquivo so
-- documenta/versiona a mudanca, ja esta refletido no banco real.
create or replace function public.bulk_find_or_create_tracks(p_rows jsonb)
returns table (row_index integer, id uuid, was_created boolean)
language plpgsql
security invoker
as $function$
declare
  v_row jsonb;
  v_index integer;
  v_id uuid;
  v_created boolean;
  v_title text;
  v_artist text;
begin
  for v_index in 0 .. jsonb_array_length(p_rows) - 1
  loop
    v_row := p_rows -> v_index;
    v_title := trim(both from coalesce(v_row->>'title', ''));
    v_artist := coalesce(v_row->>'artist', '');
    v_id := null;
    v_created := false;

    if v_title = '' then
      continue;
    end if;

    insert into public.tracks (
      user_id, title, artist, bpm, musical_key, energy, mood, notes,
      source_name, source
    )
    values (
      auth.uid(),
      v_title,
      v_artist,
      (v_row->>'bpm')::numeric,
      v_row->>'musical_key',
      (v_row->>'energy')::integer,
      v_row->>'mood',
      v_row->>'notes',
      'csv',
      'csv'
    )
    on conflict (
      user_id,
      (lower(regexp_replace(trim(both from title), '\s+'::text, ' '::text, 'g'::text))),
      (lower(regexp_replace(trim(both from coalesce(artist, ''::text)), '\s+'::text, ' '::text, 'g'::text)))
    )
    where (trim(both from title) <> ''::text)
    do nothing
    returning tracks.id into v_id;

    if v_id is not null then
      v_created := true;
    else
      select t.id into v_id
      from public.tracks t
      where t.user_id = auth.uid()
        and lower(regexp_replace(trim(both from t.title), '\s+'::text, ' '::text, 'g'::text))
          = lower(regexp_replace(trim(both from v_title), '\s+'::text, ' '::text, 'g'::text))
        and lower(regexp_replace(trim(both from coalesce(t.artist, ''::text)), '\s+'::text, ' '::text, 'g'::text))
          = lower(regexp_replace(trim(both from coalesce(v_artist, ''::text)), '\s+'::text, ' '::text, 'g'::text))
      limit 1;
    end if;

    row_index := v_index;
    id := v_id;
    was_created := v_created;
    return next;
  end loop;
end;
$function$;
