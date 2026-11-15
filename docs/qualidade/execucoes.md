# Execuções da rede de proteção (Sprint 3, parte 2)

Registro das execuções da suíte de testes antes e depois de cada refatoração. A suíte v2 da
parte 1 é a rede de proteção principal; a v1 entra como **contrato**: as refatorações não podem
mudar o resultado dela, porque ela é preservada sem edição e os números da parte 1 dependem dela.

Ambiente: Windows 11, Node 24.16.0, Vitest 4.1.8, Postgres 14 no Docker (porta 5433).
O banco de testes `BD-SICIN-TEST` é recriado antes de cada execução completa:
`node scripts/prepare-database.mjs BD-SICIN-TEST --reset`.

## Execução de base (vale para as refatorações)

15/11/2026, 18:20. Commit `245eff6` do `main`, que acrescenta a recusa da submissão repetida
(`feat(iniciativas)`, uma mudança de comportamento pedida pela dona do produto, fora das
refatorações). O código do branch `refactor/sprint3-divida-tecnica` foi atualizado com esse
commit (merge `e9a6037`) e é idêntico ao do `main`. Ainda antes de qualquer refatoração.

| Suíte | Comando | Resultado |
|---|---|---|
| v2 | `npx vitest run tests/v2` | 177 / 177 passando |
| Unitários + v2 (sem a v1) | `npm test` | 38 arquivos, 589 / 589 passando |
| v1 (contrato) | `npm run test:v1` | 80 testes: 75 passando, 5 falhando (as mesmas falhas esperadas, abaixo) |
| Integração | `npm run test:int` | 8 arquivos, 94 / 94 passando |
| E2E (API) | `npm run test:e2e` | 3 arquivos, 42 / 42 passando |

A regra nova não mudou o resultado da v1 nem o da v2: nenhum teste delas submete a mesma
iniciativa duas vezes, e nenhum arquivo delas foi alterado. Os 11 testes unitários e os 5 de
integração a mais são os da regra nova.

## Primeira execução de base (histórico)

15/11/2026, 16:05. Commit `d8c4e3a` (tag `sprint3-parte1-medicao`), antes da regra nova.

| Suíte | Comando | Resultado |
|---|---|---|
| v2 | `npx vitest run tests/v2` | 177 / 177 passando |
| Unitários + v2 (sem a v1) | `npm test` | 38 arquivos, 578 / 578 passando |
| v1 (contrato) | `npm run test:v1` | 80 testes: 75 passando, 5 falhando (as falhas esperadas, abaixo) |
| Integração | `npm run test:int` | 8 arquivos, 89 / 89 passando |
| E2E (API) | `npm run test:e2e` | 3 arquivos, 42 / 42 passando |

**Falhas esperadas da v1** (explicadas em `docs/testes/relatorios/v1/v1.md`). Qualquer
diferença nesta lista depois de uma refatoração bloqueia o commit:

1. US01 tipo inválido "OUTRO"
2. US02 reprovação com justificativa undefined
3. US02 reprovação com justificativa null
4. US02 reprovação com justificativa ""
5. US02 reprovação com justificativa "   "

## Regras para cada item DT-xx

1. Antes: `npx vitest run tests/v2` e `npm run test:v1`, anotados na tabela abaixo.
2. Se o trecho não tiver teste, primeiro um teste do comportamento atual, em `src/` ao lado do
   código (nunca em `tests/v2/`, para não mudar a contagem da parte 1).
3. Refatorar em passos pequenos, rodando a v2 a cada passo.
4. Depois: v2, v1 e `npm test`; `test:int` e `test:e2e` se o item tocar infraestrutura ou HTTP.
5. Se a v1 importar algo que a refatoração move ou renomeia, o caminho antigo continua
   reexportando o novo. A v1 nunca é editada.
6. Um commit por item, com o ID na mensagem.

## Execuções por item

15/11/2026, entre 20:04 e 20:12, na ordem abaixo. Antes do primeiro item, a base foi repetida no
commit `8b7abff` (`npm test` 589/589, v1 75/5 com as falhas esperadas).

| Item | Commit | v2 antes | v2 depois | v1 antes | v1 depois | `npm test` depois | Observação |
|---|---|---|---|---|---|---|---|
| (preparação do DT-02) | `c69bc76` | 177 / 177 | 177 / 177 | 75 / 5 | 75 / 5 | 604 / 604 | 15 testes de caracterização de `DadosIniciativa` em `src/` (regra 2). Passaram contra o código antigo. Nova base do `npm test`: 604 |
| DT-02 | `4cda5d4` | 177 / 177 | 177 / 177 | 75 / 5 | 75 / 5 | 604 / 604 | Biome no arquivo: complexidade 42 → abaixo de 15; 84 linhas → abaixo de 50; 13 parâmetros → 1 |
| DT-01 | `d767cb8` | 177 / 177 | 177 / 177 | 75 / 5 | 75 / 5 | 604 / 604 | `typecheck` e teste de arquitetura passando. Nenhum arquivo da v1 ou da v2 importava os arquivos removidos |
| DT-03 | `410e03c` | 177 / 177 | 177 / 177 | 75 / 5 | 75 / 5 | 604 / 604 | Toca HTTP: `test:int` 94 / 94 e `test:e2e` 42 / 42 (banco recriado antes). `openapi.json` exportado antes e depois: idêntico byte a byte |

Em todas as execuções da v1, as 5 falhas foram exatamente as da lista de falhas esperadas.

**Observação:** o `docs/openapi.json` versionado está desatualizado desde o cadastro de tipos
(`aa52c34`) e a regra de submissão repetida (`245eff6`): faltam as rotas de tipos e a resposta
409. A comparação do DT-03 foi feita entre duas exportações novas (antes e depois), não contra o
arquivo versionado.
