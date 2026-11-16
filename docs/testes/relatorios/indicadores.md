# Tabela de indicadores (Etapa 3): v1 × v2

Medição de 15/11/2026, tag `sprint3-parte1-medicao`, mesmo escopo e mesma ferramenta
(Vitest 4 + `@vitest/coverage-v8`). Detalhes, comandos e contagens em [`v1/v1.md`](v1/v1.md) e [`v2/v2.md`](v2/v2.md).

| Indicador | Como medir | v1 (LLM) | v2 (melhorada) |
|---|---|---|---|
| Testes gerados / passando / falhando / não compilam | Saída do test runner | 80 / 75 / 5 / 0 | 177 / 177 / 0 / 0 |
| Cobertura de linhas | coverage-v8 | 39,35% | 66,76% |
| Cobertura de branches | coverage-v8 | 34,72% | 65,27% |
| Cobertura de requisitos | Linhas da matriz com teste ÷ 54 | 72,2% (39) | 100% (54) |
| Partições cobertas | Matriz | pendente (P04) | pendente (P04) |
| Valores-limite cobertos | Limites da Etapa 1 exercitados ÷ 30 | 80% (24) | 100% (30) |
| Testes sem asserção ou com asserção trivial | Inspeção | 0 sem asserção; 16 só com `not.toThrow()` | 0 / 0 |
| Defeitos reais encontrados | Falhas investigadas | 0 | 0 |

Observações:
- 4 das 5 falhas da v1 são erro do teste (camada errada) e 1 vem de uma mudança de requisito
  posterior à geração (cadastro de tipos, ADR-024). No código anterior a essa mudança, a v1 dá
  76 / 4, com 46,37% de linhas e 40,84% de branches.
- Testes que falham também executam código e entram na cobertura da v1 (`reportOnFailure: true`).
- O critério do calendário (só APROVADAS) é coberto na v2 por um teste de integração, fora dos
  percentuais de cobertura.
