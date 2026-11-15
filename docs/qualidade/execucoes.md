# Execuções da rede de proteção (Sprint 3, parte 2)

Registro das execuções da suíte de testes antes e depois de cada refatoração. A suíte v2 da
parte 1 é a rede de proteção principal; a v1 entra como **contrato**: as refatorações não podem
mudar o resultado dela, porque ela é preservada sem edição e os números da parte 1 dependem dela.

Ambiente: Windows 11, Node 24.16.0, Vitest 4.1.8, Postgres 14 no Docker (porta 5433).
O banco de testes `BD-SICIN-TEST` é recriado antes de cada execução completa:
`node scripts/prepare-database.mjs BD-SICIN-TEST --reset`.

## Execução de base

15/11/2026, 16:05. Commit `d8c4e3a` (tag `sprint3-parte1-medicao`), antes de qualquer refatoração.

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

| Item | Commit | v2 antes | v2 depois | v1 antes | v1 depois | `npm test` depois | Observação |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
