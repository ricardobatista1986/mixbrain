# TODO — MixBrain

Pendências abertas, mais recentes no topo. Formato: data, descrição, contexto.

## 2026-08-23

- [x] **Exibição de tracks em formato lista — biblioteca.** Painel "Sugestões
  inteligentes da biblioteca" (`library-suggestions.tsx`), única tela onde
  aparecia % de match fora do projeto. Grid 2 colunas de cards → lista de
  linha única. Commit `1c2ba5c`.
- [x] **Exibição de tracks em formato lista — dentro do projeto.** Escopo
  real do pedido original (confirmado pelo Ricardo em 2026-08-24): os
  cards de track na tracklist do projeto (`page.tsx`, tanto os itens
  soltos quanto os itens dentro de blocos congelados). Cada `<article>`
  virou linha única (posição, título/artista, tags BPM/Key/Energia/Mood
  compactas, botões de mover/remover), com "Detalhes e momento no set"
  (CuratorialEditor + tags completas no mobile) atrás de um `<details>`
  colapsado por padrão. `TransitionScoreCard` (que já mostra o
  "Score MixBrain: X%" como linha única colapsável) não foi alterado —
  já estava no formato certo. **Não testado visualmente em navegador**
  (sem sessão autenticada disponível no sandbox) — só `tsc --noEmit` e
  `eslint` limpos. Vale um teste manual rápido no primeiro acesso.
