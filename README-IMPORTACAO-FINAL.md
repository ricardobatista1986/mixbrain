# MixBrain — pacote final de importação CSV

Este pacote é um **overlay** sobre o repositório atual `ricardobatista1986/mixbrain` no commit `e22c632`.

Ele contém exatamente os dois arquivos que devem ser substituídos e este registro. Não é necessário criar migration nem alterar `.env.local`.

## Arquivos para substituir

Salve os dois artefatos recebidos nos seguintes caminhos do projeto:

```text
src/app/app/importar-csv/page.tsx
src/app/app/importar-csv/server-actions.ts
```

Não substitua nem publique:

```text
.env.local
.git/
node_modules/
```

## Comportamento entregue

1. A tela passa a exigir a escolha do projeto de destino antes de importar.
2. O CSV exige `title` e `artist`, pois `tracks.artist` é `NOT NULL`.
3. Linhas duplicadas no próprio CSV são removidas pela chave normalizada `title + artist`.
4. Ação procura tracks existentes do usuário pela mesma chave.
5. Tracks inexistentes são criadas com `source_name = "csv"`.
6. Todas as tracks do CSV — tanto novas quanto reutilizadas — são vinculadas ao projeto escolhido em `set_candidates`.
7. Candidatas já existentes nesse projeto não são duplicadas.
8. Cada candidata nova recebe os campos obrigatórios confirmados:

```ts
{
  user_id: userId,
  project_id: projectId,
  track_id: trackId,
  status: "candidate",
  sort_order: proximaOrdem,
}
```

## Validação e publicação

Depois de substituir os dois arquivos, na raiz do repositório local execute:

```bash
npm install
npm run lint
npm run build
git add src/app/app/importar-csv/page.tsx src/app/app/importar-csv/server-actions.ts README-IMPORTACAO-FINAL.md
git commit -m "feat: import CSV as project candidates"
git push origin main
```

Só faça o `git push` se `npm run lint` e `npm run build` terminarem sem erro.

## Sem SQL adicional

Nenhuma migration acompanha este pacote porque o estado do Supabase já foi confirmado: RLS e policies existem, `tracks.artist` é obrigatório e `set_candidates` exige `user_id`, `status` e `sort_order`.
