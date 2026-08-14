# MixBrain — Registro técnico

**Data:** 14/08/2026
**Escopo:** implementação real de pesos personalizados por projeto

## Implementado

- Criada a action server-side `updateScoringWeights`.
- Validação de autenticação e propriedade do projeto.
- Validação de cada peso entre 0 e 100.
- Proteção contra todos os pesos zerados.
- Persistência em `set_projects.scoring_weights`.
- Revalidação da página do projeto após salvar.
- Painel React reativado para chamar a action real.
- Mensagens de sucesso e erro no painel.

## Banco

A coluna `set_projects.scoring_weights` já existia no Supabase como `jsonb`, com pesos padrão:

`bpm: 7, energy: 13, moment: 22, harmony: 16, texture: 9, diversity: 5, narrative: 28`.

Nenhuma migration adicional foi necessária.

## Commits

- `1ad74c1` — adiciona `updateScoringWeights` server-side.
- `cd2f52b` — reativa o painel persistente.

## Observação

O motor de score já aceita `ScoringWeights`. A integração da página de projeto para ler e repassar esses pesos ao cálculo visual e à organização automática ainda deve ser feita em uma próxima alteração controlada, pois requer patch específico no arquivo grande da página.
