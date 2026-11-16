# Log de interação com a LLM (Sprint 3)

## Identificação
- **LLM:** Claude (Anthropic)
- **Modelo:** Claude 3.5 Sonnet, nível de raciocínio "médio"
- **Interface:** claude.ai 
- **Datas de uso (conferidas no histórico do git):** rodada 0 e rodada 1 (v1) em 12/11/2026; rodadas da v2 entre 13/11 e 15/11/2026; medição oficial em 15/11/2026 (tag `sprint3-parte1-medicao`).
- **Matriz da Etapa 1:** commitada em 10/11/2026 (`600c73d`), antes de qualquer geração.
- **Framework de teste:** Vitest 4.1.8, com cobertura @vitest/coverage-v8 4.1.8
- **v1 (gerada pela LLM, sem edição manual):** `tests/v1-llm/iniciativas.regras-de-negocio.spec.ts`
- **v2 (v1 corrigida + testes novos):** `tests/v2/`

## Resumo das rodadas
| Rodada | Objetivo | Resultado |
| :--- | :--- | :--- |
| **0** (descartada) | Primeira tentativa de gerar a v1 | 6 arquivos, 62 testes; descartada pela equipe, ver abaixo |
| **1** | Gerar a suíte v1 para US01 a US06 | 1 arquivo, 80 testes (US01, US02, US05 e US06) |
| **v2-1** | Gerar testes só para as lacunas L1 a L10 | 4 arquivos de teste e 1 fake, 74 testes |
| **v2-2** | Corrigir asserções fracas (L11) e documentar a decisão do limite do refinamento (L12) na cópia da v1 | 12 trocas pontuais no arquivo da v2 |

---

## Rodada 0 (descartada): primeira tentativa da v1

- **Quando:** 12/11/2026, por volta das 09:16 (data dos arquivos no zip do commit `9cc3dcd`).
- **Prompt:** o texto não foi salvo. Segundo a equipe, saiu sem parte do contexto planejado, e por
  isso a tentativa foi descartada e refeita na rodada 1.
- **Resposta:** 6 arquivos de teste, um por história, com 35 blocos `it` (62 testes ao expandir os
  `it.each`): `dados-iniciativa.v1.spec.ts` e `iniciativa-us01-us05.v1.spec.ts` (US01 e US05),
  `registrar-decisao-us02.v1.spec.ts` (US02), `consultas-us03.v1.spec.ts` (US03),
  `calendario-us04.v1.spec.ts` (US04) e `comentar-iniciativa-us06.v1.spec.ts` (US06). Os arquivos
  foram guardados no zip (`9cc3dcd`) e depois concatenados num só arquivo
  (`suite_testes_v1_US01_US06.spec.ts`, commit `73f6f69`), substituído pela v1 oficial em `f144140`.
- **Execução (reproduzida em 15/11/2026):** os 6 arquivos, colocados nos caminhos de origem e
  rodados no código do mesmo dia (commit `9cc3dcd`), dão 62 de 62 passando. Ou seja, a tentativa
  descartada não tinha erro de compilação nem falhas.
- **Por que fica registrada:** o enunciado pede o log completo. A v1 oficial é a da rodada 1.

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
- Conteúdo dos arquivos igual ao do repositório no commit `a867fd4` (12/11/2026, 09:59), o último commit de `src/` antes de a v1 entrar no repositório. Os imports da v1 (por exemplo `testing/montar-casos-de-uso`) só existem a partir do commit `e8247eb`, o que confirma o estado do código usado.
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
**Medição oficial** (a que vale para o relatório): `docs/testes/relatorios/v1/v1.md`, no código
da tag `sprint3-parte1-medicao`, com o mesmo escopo da v2 (`domain` e `application` de
iniciativas, divulgacao, refinamento e avaliacao):
- 80 testes: 75 passando, 5 falhando, 0 não compilam.
- Cobertura: 39,35% de linhas e 34,72% de branches. Relatório em `docs/testes/relatorios/v1/html/`.
- A 5ª falha (tipo "OUTRO") apareceu com o cadastro de tipos (15/11/2026), sem mudança na v1.

**Medições anteriores** (histórico, com escopos e códigos diferentes, por isso não comparáveis):
- Escopo só do módulo iniciativas: 80 / 76 / 4, com 84,69% de linhas e 76,4% de branches. O
  relatório ficava em `docs/testes/relatorios/v1/escopo-original/`, removido em `a030089`
  (continua no histórico do git).
- Escopo de US01 a US06 no código anterior ao cadastro de tipos (`2c4462f`): 80 / 76 / 4, com
  46,37% de linhas e 40,84% de branches. Relatório em
  `docs/testes/relatorios/v1/historico-antes-do-cadastro-de-tipos/`. Uma execução intermediária,
  com outro escopo, chegou a 48,17% e 42,1%; dela não ficou relatório.

### Investigação das falhas (Etapa 2, passo 6)
- Testes: "US02 reprovação com justificativa undefined / null / "" / "   "".
- Causa: erro do teste (camada errada, módulo avaliacao não fornecido)
- Ações: reenviar as partes do projeto necessárias para essa função. Foi enviada a pasta Zip src/modules/avaliação. A v1 não foi alterada: as 4 falhas continuam nela, e a correção do setup foi feita na v2 (`us02-registrar-decisao.spec.ts`).
- Pela API a regra funciona: `RegistrarDecisao` chama `validarDecisao` e responde 422. Não é defeito do sistema (0 defeitos reais).

---

## Rodada v2-1: geração dos testes das lacunas

### Prompt
O texto integral deste prompt **não foi salvo** (nem no repositório nem no histórico do git), e
por isso não é reproduzido aqui. O que a equipe registrou do pedido: gerar testes **apenas** para
as lacunas L1 a L10 identificadas na análise da v1, sem instanciar bibliotecas de fora do projeto,
seguindo os critérios de aceitação e os limites da matriz da Etapa 1. Os arquivos gerados estão
em `tests/v2/` e são a evidência do que foi pedido.

### Contexto fornecido à LLM
- Código do back-end em arquivo(s) zip e a suíte v1. 

Arquivos da v2 (`tests/v2/`), com a rodada de origem e as lacunas que cada um resolve
(definição de L1 a L13 na nota 3 de `docs/testes/tabela.md`):
| Arquivo | Origem | Lacunas | Testes |
| :--- | :--- | :--- | :--- |
| `us03-painel-consultas.spec.ts` | v2-1 (13/11) | L1 | 14 |
| `us04-calendario-recorrencia.spec.ts` | v2-1 (13/11) | L2, L4 | 25 |
| `us06-comentarios.spec.ts` | v2-1 (13/11) | L3, L5 | 11 |
| `lacunas-restantes.spec.ts` | v2-1 (13/11) | L6, L7, L8, L9, L10 | 24 |
| `helpers/painel-em-memoria.ts` | v2-1 (13/11) | apoio (fake) | — |
| `iniciativas.regras-de-negocio.spec.ts` | cópia da v1 corrigida na v2-2 | L11, L12 | 76 |
| `us02-registrar-decisao.spec.ts` | equipe (15/11, `2c4462f`) | L13 | 17 |
| `us02-acesso-negado.spec.ts` | equipe (15/11, `2c4462f`) | L7 | 10 |
| **Total** | | | **177** |

### Resumo da resposta
4 arquivos de teste novos (US03, US04, US06 e lacunas restantes) e 1 fake (`painel-em-memoria.ts`), com 74 testes, todos passando na primeira execução. Os 2 arquivos de US02 (`us02-registrar-decisao` e `us02-acesso-negado`) entraram depois, em 15/11 (`2c4462f`).

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
Resultado: 12 trocas pontuais de oráculos (ex: trocar `not.toThrow()` por checagens de estado específicas). Diff conferido entre a v1 original e a cópia corrigida. Depois das trocas, nenhum dos 16 testes fracos da v1 ficou só com `not.toThrow()` (algumas trocas valem para vários testes de um `it.each`). Os 4 testes da justificativa saíram da cópia e foram refeitos pelo caminho real em `us02-registrar-decisao.spec.ts` (L13), por isso a cópia tem 76 testes e não 80.

---

## Decisões da equipe e Resultados Finais da V2

1. **Limite do fim do refinamento (L12):** No instante exato do fim (por exemplo, 10:00) o refinamento já está encerrado; só se comenta até o instante anterior (9:59). O código atual (`>=`) já se comporta assim, então nenhum teste mudou de resultado. 
2. **Defeito da justificativa (US02):** Não era defeito, apenas faltou enviar as partes necessárias do projeto para essa função
3. **Cobertura de 100% na V2:** Anteriormente, havia critérios sem teste unitário ("Não aprovadas no calendário" e "acesso negado"). Para validar esses critérios e garantir 100% de cobertura da matriz, a equipe executou os testes de integração (`test:int`), configurando com sucesso o ambiente Docker.
4. **Resultado final da v2 (medição oficial, `docs/testes/relatorios/v2/v2.md`):** `tests/v2` com 177 testes, todos passando; 66,76% de linhas e 65,27% de branches, no mesmo escopo da v1; requisitos 54 de 54, partições 39 de 39 e valores-limite 30 de 30. O critério do calendário (só aprovadas) é coberto por 1 teste de integração (`test/integration/iniciativas/calendario-somente-aprovadas.int-spec.ts`), que não entra nos percentuais.
5. **Números anteriores:** os 80,43% de linhas e 77,77% de branches registrados antes vêm dos mesmos 177 testes rodados no código anterior ao cadastro de tipos (`2c4462f`, escopo de 511 linhas em vez de 653). A execução foi reproduzida em 15/11 com os mesmos números (`docs/testes/relatorios/v2/historico-antes-do-cadastro-de-tipos/`). Os testes de integração do projeto (`test/integration/`) existem desde a Sprint 2 e não fazem parte da v2.
