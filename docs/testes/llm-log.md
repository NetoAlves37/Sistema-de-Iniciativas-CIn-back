# Log de interação com a LLM (Sprint 3)

## Identificação
- **LLM:** Claude (Anthropic)
- **Modelo:** Claude 3.5 Sonnet, nível de raciocínio "médio"
- **Interface:** claude.ai 
- **Datas de uso:** v1 em 09/11/2026; v2 em 11/11/2026; execuções e medições em 13/11/2026 e finalização em 15/11/2026.
- **Framework de teste:** Vitest 4.1.12, com cobertura @vitest/coverage-v8
- **v1 (gerada pela LLM, sem edição manual):** `tests/v1-llm/iniciativas.regras-de-negocio.spec.ts`
- **v2 (v1 corrigida + testes novos):** `tests/v2/`

## Resumo das rodadas
| Rodada | Objetivo | Resultado |
| :--- | :--- | :--- |
| **1** | Gerar a suíte v1 para US01 a US06 | 1 arquivo, 80 testes (US01, US02, US05 e US06) |
| **v2-1** | Gerar testes só para as lacunas L1 a L10 | 4 arquivos de teste e 1 fake, 74 testes |
| **v2-2** | Corrigir asserções fracas (L11) e documentar a decisão do limite do refinamento (L12) na cópia da v1 | 12 trocas pontuais no arquivo da v2 |

---

## Rodada 1: geração da v1

### Prompt (texto completo)
```text
Olá! Estou realizando uma atividade acadêmica de testes automatizados com o framework Vitest.
Preciso que você gere uma suíte completa de testes unitários em Vitest (versão 1 - sem edições manuais) para as regras de negócio do meu sistema de iniciativas acadêmicas.

--- REQUISITOS E CRITÉRIOS DE ACEITAÇÃO ---

US01 - Submissão de Iniciativa:
- Sucesso: Todos os campos obrigatórios válidos mudam o status para EM_ANDAMENTO.
- Erros de Validação: Tipo diferente de EXTENSAO, PESQUISA ou EVENTO; Título vazio ou > 120 caracteres; Resumo vazio ou > 280 caracteres; Detalhe vazio ou > 5000 caracteres.
- Datas e Horários: Formato inválido; Data de término anterior à de início; Horário de término <= início.
- Espaço/Local: Vazio ou > 200 caracteres.
- Outros Erros: Periodicidade fora do permitido; Organizadores vazios; Participantes < 1 ou não inteiro.

US02 - Avaliação de Iniciativa:
- Apenas iniciativas EM_ANALISE podem ser avaliadas. (Erro se status for diferente).
- Aprovação: Status muda para APROVADA.
- Reprovação: Status muda para REPROVADA e exige justificativa (erro se justificativa for vazia).
- Restrições: Autor não pode avaliar própria iniciativa; Usuário sem permissão (não comitê/admin) recebe acesso negado.
- Após avaliação, a iniciativa não fica mais disponível na fila de análise.

US03 e US04 - Visualização e Calendário:
- Filtros: Visualizar por status, ver apenas as próprias iniciativas, e ver contagem por status.
- Calendário: Apenas iniciativas com status APROVADA aparecem no calendário. Intervalos de consulta > 62 dias ou datas inválidas retornam erro.

US05 - Edição e Ressubmissão:
- Edição: Apenas o autor pode editar e apenas se o status for EM_ANDAMENTO.
- Ressubmissão: Apenas o autor pode ressubmeter iniciativas com status REPROVADA. Ao ressubmeter, o ciclo é incrementado (+1) e o status volta para EM_ANDAMENTO.
- É permitido ressubmeter com dados idênticos aos anteriores (operação aceita).

US06 - Comentários:
- Sucesso: Comentários (até 1000 caracteres) permitidos apenas com status EM_ANDAMENTO e fase de refinamento aberta.
- Erros: Comentário vazio; Comentário > 1000 caracteres; Iniciativa inexistente; Fase de refinamento encerrada ou status diferente de EM_ANDAMENTO (ex: EM_VOTACAO, EM_ANALISE, APROVADA, REPROVADA).

--- CÓDIGO FONTE DO SISTEMA (BACK-END) ---

[código dos arquivos listados abaixo em "Contexto fornecido à LLM"]
O projeto utiliza: TypeScript e Vitest.

--- ORIENTAÇÕES OBRIGATÓRIAS DE CÓDIGO ---
1. Escreva a suíte de testes utilizando o framework Vitest (describe, it, expect).
2. O código do teste deve importar e testar diretamente as classes, entidades e funções do código fornecido acima. Faça os mocks (vi.fn(), etc) estritamente necessários para o código compilar e rodar.
3. Aplique explicitamente as técnicas de Partições de Equivalência e Análise de Valores-Limite (especialmente nos testes de limite de caracteres e datas da US01 e US06).
4. Adicione um comentário no início de cada bloco it() indicando:
  - O Requisito / US testado.
  - A técnica usada (Partição de Equivalência ou Valor-Limite).
  - O resultado esperado.
```

### Contexto fornecido à LLM
- Critérios de aceitação das US01 a US06, reescritos pela equipe em texto corrido. A matriz da Etapa 1 não foi mostrada.
- Código colado no prompt, na ordem: `alterar-iniciativa.ts`, `aplicar-prazos-vencidos.ts`, `carregar-com-prazos.ts`, `decidir-iniciativa.ts`, `editar-iniciativa.ts`, `ressubmeter-iniciativa.ts` e `submeter-iniciativa.ts` (todos em `src/modules/iniciativas/application/use-cases/`).
- Colados também 4 arquivos de teste que já existiam no projeto: `RegistrarDecisao`, `EditarIniciativa`, `RessubmeterIniciativa` e `SubmeterIniciativa`.
- Conteúdo dos arquivos idêntico ao do repositório no commit (hash).
- O código do domínio e dos helpers de teste foi anexado como arquivo
- Não foram fornecidos o código de consultas (US03), calendário (US04) e do caso de uso de comentar (US06). A própria LLM avisou isso num comentário do teste.

### Resumo da resposta
Um único arquivo com 80 testes: US01 (46), US02 (13), US05 (13) e US06 (8). Nenhum teste para US03 e US04. Cada teste traz, no título ou em comentário, a técnica usada. Reaproveitou os helpers dos testes existentes.

### Problemas observados
- Nenhum erro de import ou de sintaxe: 0 testes não compilam.
- 4 testes falham (US02, reprovação com justificativa undefined, null, "" e "   ").
- A LLM declarou no código que supôs os nomes dos campos de `entrada()`. A suposição se confirmou.
- O limite do fim do refinamento foi escrito com base no código ("o domínio usa >="), e não em um requisito. Tratado na decisão L12 abaixo.

### Execução e medição da v1
**Escopo original** (domínio e casos de uso do módulo iniciativas)
- Comando: `npx vitest run tests/v1-llm --coverage`
- Resultado: 80 testes, 76 passando, 4 falhando, 0 não compilam.
- Cobertura: 84,69% de linhas e 76,4% de branches (com 4 testes falhando).
- Relatório salvo em `docs/testes/relatorios/v1/escopo-original/`

**Escopo ampliado** (US01 a US06 - iniciativas, divulgacao e refinamento)
- Resultado: 80 testes, 76 passando, 4 falhando.
- Cobertura: 48,17% de linhas e 42,1% de branches.
- Relatório salvo em `docs/testes/relatorios/v1/`

### Investigação das falhas (Etapa 2, passo 6)
- Testes: "US02 reprovação com justificativa undefined / null / "" / "   "".
- Causa: erro do teste (camada errada, módulo avaliacao não fornecido)
- Ações: reenviar as partes do projeto necessárias para essa função. Foi enviada a pasta Zip src/modules/avaliação

---

## Rodada v2-1: geração dos testes das lacunas

### Prompt (texto completo)
*(O prompt enviado solicitava testes APENAS para as lacunas L1 a L10 identificadas pela equipe, incluindo regras de não instanciar libs de fora e focando nos critérios de aceitação e limites estabelecidos na Etapa 1)*.

### Contexto fornecido à LLM
- Código do back-end em arquivo(s) zip e a suíte v1. 

Arquivos entregues:
| Arquivo | Lacunas |
| :--- | :--- |
| `us02-registrar-decisao.spec` | L7, L8 |
| `us02-acesso-negado.spec` | L7 |
| `iniciativas.regras-de-negocio.spec` | suíte v1 |
| `us03-painel-consultas.spec.ts` | L1 |
| `us04-calendario-recorrencia.spec.ts` | L2, L4 |
| `us06-comentarios.spec.ts` | L3, L5 |
| `lacunas-restantes.spec.ts` | L6, L7, L8, L9, L10 |
| `helpers/painel-em-memoria.ts` | apoio (fake) |

### Resumo da resposta

### Problemas e observações
- Fake novo criado pela LLM (`painel-em-memoria.ts`).
- Dois critérios ficaram só como comentário, por dependerem de SQL/Docker e guards do Nest. (Resolvidos posteriormente na execução final da V2).
- Risco anotado pela LLM: `decidir-iniciativa.ts` recebe só o `decisorId` e não confere o papel. Se o guard falhar, um usuário comum poderia decidir. 

### Execução real da v2-1
- Após copiar o helper que a LLM indicou, a suíte rodou com 4 arquivos e 74 testes novos passando (0 falhando). 
- Cobertura provisória apenas desses testes no escopo ampliado: 75% de linhas e 64,7% de branches.

---

## Rodada v2-2: correções L11 e L12 na cópia da v1

### Pedido e Resultado
A equipe pediu ajuda para reforçar asserções fracas e registrar no código a decisão sobre o limite do fim do refinamento na cópia da v1.
Resultado: 12 trocas pontuais de oráculos (ex: trocar `not.toThrow()` por checagens de estado específicas). Diff conferido entre a v1 original e a cópia corrigida.

---

## Decisões da equipe e Resultados Finais da V2

1. **Limite do fim do refinamento (L12):** No instante exato do fim (por exemplo, 10:00) o refinamento já está encerrado; só se comenta até o instante anterior (9:59). O código atual (`>=`) já se comporta assim, então nenhum teste mudou de resultado. 
2. **Defeito da justificativa (US02):** Não era defeito, apenas faltou enviar as partes necessárias do projeto para essa função
3. **Cobertura de 100% na V2:** Anteriormente, havia critérios sem teste unitário ("Não aprovadas no calendário" e "acesso negado"). Para validar esses critérios e garantir 100% de cobertura da matriz, a equipe executou os testes de integração (`test:int`), configurando com sucesso o ambiente Docker.
4. **Resultado Final V2:** 177 testes unitários passando, 81 testes de integração passando. Cobertura Vitest (v8) atingiu **80.43%** de linhas e a cobertura de requisitos chegou aos **54 de 54 critérios (100%)**.
