# TODO — MixBrain

Pendências abertas, mais recentes no topo. Formato: data, descrição, contexto.

## 2026-08-23

- [x] **Exibição de tracks em formato lista.** ~~Trocar a exibição de
  tracks (biblioteca e/ou tracklist do projeto — confirmar escopo exato
  com o Ricardo) e o % de match das tracks para formato de lista, em vez
  do layout atual em cards.~~ Escopo real era o painel "Sugestões
  inteligentes da biblioteca" (`library-suggestions.tsx`) — único lugar
  do app onde aparecia % de match. Era grid 2 colunas de cards, virou
  lista de linha única. A biblioteca principal (`tracks-library.tsx`) já
  era lista — não precisou mexer. Commit `1c2ba5c`.
