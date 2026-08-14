-- Impede duplicação de tracks por usuário, comparando título e artista
-- após remover espaços extras e normalizar maiúsculas/minúsculas.
--
-- Antes de aplicar esta migration, os grupos existentes foram consolidados:
-- referências de candidatas e tracklist foram redirecionadas para a
-- track canônica antes da remoção das cópias.

create unique index if not exists tracks_user_normalized_identity_unique
on public.tracks (
  user_id,
  lower(regexp_replace(trim(title), '\s+', ' ', 'g')),
  lower(regexp_replace(trim(coalesce(artist, '')), '\s+', ' ', 'g'))
)
where trim(title) <> '';

-- A importação deve continuar resolvendo uma linha CSV contra esta mesma
-- identidade antes de inserir: quando existir, reutiliza o registro já
-- persistido e apenas cria o vínculo de candidata no projeto, se necessário.
