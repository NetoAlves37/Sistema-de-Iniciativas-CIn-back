# Log da análise de qualidade (Sprint 3, parte 2)

Registro de **como** os problemas de qualidade foram procurados: ferramentas, LLM e leitura
manual. Cada achado de ferramenta ou de LLM só vira item de dívida técnica (`divida-tecnica.md`)
depois de **confirmado por alguém da equipe lendo o código**. Os descartados ficam registrados
aqui, com o motivo.

- **Código analisado:** commit `b1352d3` (branch `refactor/sprint3-divida-tecnica`), igual ao
  código da tag `sprint3-parte1-medicao`.
- **Escopo:** `src/modules/*` (código de produção, sem testes nem pastas `testing/`) e
  `src/shared/domain`. Ficam de fora `src/common/`, `modules/health` e as configurações, que são
  do boilerplate.
- **Ordem dos módulos:** pelos que têm mais regra de negócio primeiro: `iniciativas`,
  `avaliacao`, `refinamento`, `votacao`, `divulgacao`, `identidade` e, por último, a visão
  entre módulos (acoplamento e integridade conceitual).

## Resumo

| Forma | Situação | Achados brutos | Aceitos | Descartados |
|---|---|---|---|---|
| Ferramenta: Biome 2.4.16 | Feita em 15/11/2026 | 32 | 4 achados, em 2 itens (DT-02 e DT-03) | 20 (seção 4.2); 8 fora da consolidação |
| Ferramenta: jscpd 4.3.0 (duplicação) | Feita em 15/11/2026 | 7 clones | 1 (DT-04) | 6 fora da consolidação |
| Ferramenta: madge 8.0.0 (dependências) | Feita em 15/11/2026 | 3 ciclos | 3 (DT-06) | — |
| LLM: Claude Opus 5.5 | Feita em 15/11/2026, 7 rodadas | 159 | Contribuiu para os 8 itens (DT-01 a DT-08) | 1 falso positivo confirmado (R2 #11); os demais ficaram fora da consolidação |
| Leitura manual | Roteiro abaixo (a fazer) | — | — | — |

---

## 1. Ferramentas

### 1.1 Biome 2.4.16 (já instalado no projeto)

O backend usa Biome, não ESLint. As regras equivalentes às sugeridas pelo documento
(`complexity`, `max-lines-per-function`, `max-params` e `no-magic-numbers`) foram rodadas só
para a análise, pela linha de comando, sem alterar o `biome.json`. Saída completa, com os comandos:
[`ferramentas/biome.txt`](ferramentas/biome.txt).

| Regra do Biome | Equivale a | Limite | Achados |
|---|---|---|---|
| `complexity/noExcessiveCognitiveComplexity` | `complexity` | 15 | 1: `DadosIniciativa.criar` (complexidade 42) |
| `complexity/noExcessiveLinesPerFunction` | `max-lines-per-function` | 50 linhas | 1: `DadosIniciativa.criar` (84 linhas) |
| `complexity/useMaxParams` | `max-params` | 4 | 13, todos em `iniciativas`: 8 no domínio e na aplicação (o maior é `DadosIniciativa`, com 13), 1 em `prisma-tipo.repository.ts` e 4 nas fábricas do `iniciativas.module.ts` |
| `style/noMagicNumbers` | `no-magic-numbers` | — | 17, espalhados em DTOs, controllers e no domínio |

**Triagem dos achados do Biome** (preencher depois de olhar cada trecho):

| Achado | Decisão | Motivo | Quem confirmou |
|---|---|---|---|
| `dados-iniciativa.ts:85` complexidade 42 e 84 linhas | | | |
| `dados-iniciativa.ts:62` 13 parâmetros | | | |
| `iniciativas.facade.ts:50` 8 parâmetros | | | |
| `iniciativa.ts:108`, `:338` e `:418` (5, 5 e 6 parâmetros) | | | |
| `submeter-iniciativa.ts:13` e `carregar-com-prazos.ts:21` | | | |
| `iniciativas.module.ts:82`, `:93`, `:173` e `:209` (fábricas do Nest) | | | |
| `iniciativa.events.ts:33` e `prisma-tipo.repository.ts:92` | | | |
| 17 números mágicos | | | |

Dica: nas fábricas `useFactory` do Nest, receber muitas dependências é normal (é injeção de
dependência). Esses achados tendem a ser falsos positivos, e vale anotar o porquê.

### 1.2 jscpd 4.3.0 (código duplicado)

Rodado com `npx` só para a análise, sem entrar no `package.json`. Configuração padrão (mínimo
de 5 linhas e 50 tokens por clone). Saídas: [`ferramentas/jscpd.txt`](ferramentas/jscpd.txt) e
[`ferramentas/jscpd/jscpd-report.md`](ferramentas/jscpd/jscpd-report.md).

```bash
npx jscpd@4 src/modules src/shared --ignore "**/*.spec.ts,**/testing/**" --reporters console,markdown --output docs/qualidade/ferramentas/jscpd
```

Resultado: 120 arquivos, 5.925 linhas, **7 clones, 86 linhas duplicadas (1,45%)**.

| # | Clone | Tamanho | Decisão | Motivo | Quem confirmou |
|---|---|---|---|---|---|
| 1 | `refinamento/infrastructure/adapters/iniciativa.adapter.ts` [1-19] = `votacao/infrastructure/adapters/iniciativa.adapter.ts` [1-19] | 18 linhas | | | |
| 2 | `iniciativas/presentation/http/iniciativas.dto.ts` [51-57] = mesmo arquivo [21-27] | 6 linhas | | | |
| 3 | `iniciativas/presentation/http/iniciativas.controller.ts` [7-18] = `tipos-iniciativa.controller.ts` [8-19] | 11 linhas | | | |
| 4 | `iniciativas/application/use-cases/editar-iniciativa.ts` [11-21] = `ressubmeter-iniciativa.ts` [13-23] | 10 linhas | | | |
| 5 | `divulgacao/application/dto/divulgacao.dto.ts` [30-45] = `iniciativas/application/ports/iniciativa-leitura.port.ts` [49-64] | 15 linhas | | | |
| 6 | `avaliacao/presentation/http/avaliacao.controller.ts` [8-17] = `iniciativas/.../tipos-iniciativa.controller.ts` [9-18] | 9 linhas | | | |
| 7 | `avaliacao/application/dto/avaliacao.dto.ts` [18-35] = `divulgacao/application/dto/divulgacao.dto.ts` [12-29] | 17 linhas | | | |

Observação para a reflexão final: o jscpd **não** encontrou a lista `PERIODICIDADES` repetida em
`divulgacao/domain/periodicidade.ts:1` e `iniciativas/domain/tipos.ts:11`, porque ela ocupa uma
linha só, abaixo do mínimo de tokens. Os clones 3 e 6 parecem ser cabeçalhos de controller
(imports e decorators), candidatos a falso positivo.

### 1.3 madge 8.0.0 (dependências e ciclos)

Saída: [`ferramentas/madge-circular.txt`](ferramentas/madge-circular.txt).

```bash
npx madge@8 --ts-config tsconfig.json --extensions ts --exclude '\.spec\.ts$|/testing/' --circular src
```

Resultado: 156 arquivos, **3 dependências circulares**, todas no nível dos módulos Nest:

| # | Ciclo | Decisão | Motivo | Quem confirmou |
|---|---|---|---|---|
| 1 | `iniciativas.module.ts` ↔ `divulgacao.module.ts` | | | |
| 2 | `iniciativas.module.ts` ↔ `refinamento.module.ts` | | | |
| 3 | `iniciativas.module.ts` ↔ `votacao.module.ts` | | | |

São o ciclo conhecido da ADR-013 (resolvido em tempo de execução com `ModuleRef` preguiçoso). O
madge confirma com ferramenta o que a ADR registrava em texto. O projeto também tem um teste de
arquitetura (`src/architecture.spec.ts`, com ts-morph) que controla as dependências entre camadas
e módulos e pode ser citado como evidência do que já é verificado automaticamente.

---

## 2. LLM

### 2.1 Identificação

- **LLM e modelo:** Claude Opus 5.5 (`claude-opus-5-5`, Anthropic)
- **Interface:** Claude Code (extensão do VS Code). Cada rodada rodou num agente separado, que
  recebeu só o prompt e o arquivo de contexto do módulo, sem acesso ao resto do repositório,
  sem rodar comandos e sem ver as outras rodadas, a saída das ferramentas ou os candidatos da
  parte 1. É o equivalente a uma conversa nova por rodada.
- **Data de uso:** 15/11/2026, com as 7 rodadas em paralelo, entre 16h40 e 16h50.
- **Rodadas de acompanhamento:** nenhuma. As respostas foram salvas sem edição.

### 2.2 Protocolo

1. Uma rodada por módulo, na ordem abaixo. Cada rodada usa o **prompt completo** da seção 2.3
   seguido do conteúdo integral do arquivo de contexto indicado.
2. Os arquivos de contexto ficam em [`llm/contexto/`](llm/contexto/) e foram gerados no commit
   `b1352d3`: é exatamente o código que a LLM recebe. Não edite esses arquivos.
3. **Não mostre à LLM** a saída do Biome, a lista de candidatos nem a análise manual. A ideia é
   ver o que ela encontra sozinha, para a comparação da reflexão final.
4. Salve a resposta **inteira e sem edição** em `llm/respostas/rodada-N-<modulo>.md`.
5. Preencha a tabela de triagem da rodada: cada achado é **aceito** (vira DT-xx) ou
   **descartado** (falso positivo, decisão de projeto consciente, irrelevante), sempre com o
   motivo e com quem confirmou lendo o código.
6. Se precisar de uma pergunta de acompanhamento (por exemplo, "mostre o trecho exato do item
   3"), registre-a como rodada "N.b", com o texto completo.

### 2.3 Prompt base (texto completo)

Em cada rodada, troque `<MÓDULO>` pelo nome do módulo e cole o arquivo de contexto no lugar indicado.

```text
Você vai revisar a qualidade de projeto de um módulo de um sistema real. Não quero saber se o
código funciona, e sim se ele está bem projetado.

Contexto do sistema: backend de um "Sistema de Iniciativas" de uma universidade. A comunidade
submete iniciativas (eventos, pesquisa, extensão), comenta durante um período de refinamento,
vota, e um comitê aprova ou reprova. Stack: TypeScript, NestJS 11, Prisma 5 e PostgreSQL. Cada
módulo é organizado em camadas: domain (entidades, regras e portas), application (casos de uso
e consultas), infrastructure (persistência e adaptadores) e presentation (controllers HTTP e DTOs).

Abaixo está o código completo do módulo <MÓDULO> (sem os testes). Analise-o e aponte:

1. Violações de propriedades de projeto: integridade conceitual, information hiding (ocultamento
   de informação), coesão e acoplamento.
2. Violações dos princípios SOLID: SRP, OCP, LSP, ISP e DIP.
3. Code smells: Long Method, Large Class, Duplicated Code, Feature Envy, Long Parameter List,
   Switch Statements, Magic Numbers, ou outros que você identificar.

Regras para a resposta:
- Para cada problema, indique o arquivo, a função ou classe e o trecho de código exato (copiado
  do código abaixo). Não aponte nada sem trecho.
- Não invente arquivos, funções ou linhas que não aparecem no código abaixo.
- Diga por que aquilo atrapalha, de forma concreta: o que fica difícil de mudar, o que fica
  difícil de testar ou onde é fácil introduzir um defeito.
- Indique sua confiança (alta, média ou baixa) em cada achado. Se algo parecer uma decisão de
  projeto intencional, diga isso.
- Sugira a refatoração do catálogo que resolveria (Extract Function, Extract Class, Move
  Function, Introduce Parameter Object, Replace Magic Literal, etc.).

Formato: uma tabela com as colunas
| # | Arquivo e função/classe | Trecho | Problema | Categoria (propriedade, SOLID e/ou smell) | Por que atrapalha | Refatoração sugerida | Confiança |
Depois da tabela, liste em poucas linhas o que você olhou e não considerou problema.

=== CÓDIGO DO MÓDULO <MÓDULO> ===
<cole aqui o conteúdo integral do arquivo de contexto>
```

### 2.4 Rodadas

| Rodada | Módulo | Arquivo de contexto | Tamanho | Resposta salva em |
|---|---|---|---|---|
| 1 | iniciativas | [`llm/contexto/iniciativas.txt`](llm/contexto/iniciativas.txt) | 45 arquivos, 3.498 linhas | `llm/respostas/rodada-1-iniciativas.md` |
| 2 | avaliacao | [`llm/contexto/avaliacao.txt`](llm/contexto/avaliacao.txt) | 10 arquivos, 354 linhas | `llm/respostas/rodada-2-avaliacao.md` |
| 3 | refinamento | [`llm/contexto/refinamento.txt`](llm/contexto/refinamento.txt) | 17 arquivos, 570 linhas | `llm/respostas/rodada-3-refinamento.md` |
| 4 | votacao | [`llm/contexto/votacao.txt`](llm/contexto/votacao.txt) | 13 arquivos, 485 linhas | `llm/respostas/rodada-4-votacao.md` |
| 5 | divulgacao | [`llm/contexto/divulgacao.txt`](llm/contexto/divulgacao.txt) | 15 arquivos, 609 linhas | `llm/respostas/rodada-5-divulgacao.md` |
| 6 | identidade | [`llm/contexto/identidade.txt`](llm/contexto/identidade.txt) | 13 arquivos, 355 linhas | `llm/respostas/rodada-6-identidade.md` |
| 7 | entre módulos | [`llm/contexto/entre-modulos.txt`](llm/contexto/entre-modulos.txt) | 15 arquivos, 816 linhas e 14 dependências | `llm/respostas/rodada-7-entre-modulos.md` |

Na **rodada 7**, use este prompt no lugar do prompt base:

```text
Você vai revisar a qualidade de projeto da relação entre os módulos de um sistema real. Não quero
saber se o código funciona, e sim se ele está bem projetado.

Contexto do sistema: backend de um "Sistema de Iniciativas" de uma universidade, em TypeScript,
NestJS 11, Prisma 5 e PostgreSQL, dividido nos módulos iniciativas, avaliacao, refinamento,
votacao, divulgacao e identidade. Abaixo estão: o código de src/shared/domain (compartilhado),
a fachada pública e o módulo Nest de cada módulo, e a lista de imports entre módulos
("A -> B" significa que um arquivo de A importa algo de B).

Analise e aponte:
1. Acoplamento entre módulos: dependências circulares, módulos que conhecem detalhes internos de
   outros, mudanças em um módulo que obrigariam a mudar vários outros.
2. Information hiding: o que cada fachada expõe além do necessário.
3. Integridade conceitual: módulos que tratam erros, nomeiam coisas ou acessam dados de jeitos
   diferentes entre si.
4. Violações de DIP e ISP entre os módulos.

Regras para a resposta:
- Para cada problema, indique os arquivos envolvidos e o trecho exato (copiado do código abaixo).
- Não invente arquivos ou dependências que não aparecem abaixo.
- Diga por que aquilo atrapalha, de forma concreta.
- Indique sua confiança (alta, média ou baixa) e se algo parece decisão intencional.
- Sugira a refatoração que resolveria.

Formato: uma tabela com as colunas
| # | Módulos e arquivos | Trecho | Problema | Categoria | Por que atrapalha | Refatoração sugerida | Confiança |

=== CONTEXTO ENTRE MÓDULOS ===
<cole aqui o conteúdo integral de llm/contexto/entre-modulos.txt>
```

### 2.5 Registro das rodadas

Em todas as rodadas: prompt da seção 2.3 (ou o da rodada 7) seguido do arquivo de contexto do
módulo, data 15/11/2026 e resposta salva integralmente em `llm/respostas/`.

| Rodada | Módulo | Achados | Por categoria principal (propriedade / SOLID / smell) | Confiança (alta / média / baixa) |
|---|---|---|---|---|
| 1 | iniciativas | 39 | 11 / 5 / 23 | 21 / 16 / 2 |
| 2 | avaliacao | 18 | 8 / 3 / 7 | 3 / 9 / 6 |
| 3 | refinamento | 22 | 8 / 3 / 11 | 6 / 10 / 6 |
| 4 | votacao | 22 | 8 / 4 / 10 | 7 / 10 / 5 |
| 5 | divulgacao | 21 | 5 / 4 / 12 | 4 / 12 / 5 |
| 6 | identidade | 17 | 11 / 1 / 5 | 4 / 7 / 6 |
| 7 | entre módulos | 20 | 18 / 2 / 0 | 9 / 9 / 2 |
| **Total** | | **159** | **69 / 22 / 68** | **54 / 73 / 32** |

As contagens por categoria seguem a primeira categoria citada em cada linha (muitos achados
citam mais de uma).

#### Conferência dos trechos citados (alucinação)

Todo achado precisava trazer o trecho exato do código. Um script comparou cada trecho entre
crases com o arquivo de contexto daquela rodada:

| | Achados |
|---|---|
| Todos os trechos encontrados literalmente | 127 |
| Parte dos trechos encontrados | 29 |
| Nenhum trecho encontrado literalmente | 3 |
| Sem trecho | 0 |

Os 29 parciais são abreviações (a LLM cortou o trecho com `...`, juntou várias linhas numa só
ou pôs crases dentro de comentários). Os 3 sem correspondência (R1 #37, R3 #10 e R6 #6) foram
conferidos à mão: os trechos existem, só que quebrados em várias linhas no código.
**Nenhum trecho inventado foi encontrado.**

#### Problemas observados nas respostas

- **Falso positivo por falta de contexto (R2 #11):** a LLM afirma que o `forwardRef` de
  `avaliacao.module.ts` indica dependência circular entre `avaliacao` e `iniciativas`. Não
  indica: `iniciativas` não importa nada de `avaliacao`, e o madge não encontrou esse ciclo. A
  LLM deduziu o ciclo do `forwardRef` porque não via o outro módulo.
- **Duplicação entre módulos não detectada (R1):** a `PERIODICIDADES` está declarada igual em
  `iniciativas/domain/tipos.ts` e em `divulgacao/domain/periodicidade.ts`. Na rodada 1 a LLM
  elogiou a constante como "boa fonte única", e na rodada 5 não a citou. Como cada rodada vê um
  módulo só, a duplicação entre módulos fica invisível. Na rodada 5 ela encontrou um caso
  parecido, o `FORMATO_CODIGO_TIPO` copiado de iniciativas (R5 #3), porque um comentário do
  próprio código avisava.
- **Mesmo achado em várias rodadas:** o ciclo entre módulos aparece em R1 #2, R2 #11, R3 #15,
  R4 #18, R5 #1 e R7 #1 e #2. A fachada que instancia os próprios casos de uso aparece em
  R3 #8, R4 #13, R6 #4 e R7 #11. Na consolidação, cada um conta uma vez.
- **Decisões de projeto conscientes apontadas como problema:** o ciclo entre módulos (ADR-013)
  e a leitura de `votacao_placar` na listagem (R1 #3, ADR-002). A LLM marcou alguns como
  possivelmente intencionais, mas não sabia das ADRs.
- **Achados de baixa relevância:** nomes de tokens (R3 #21), mistura de verbo e substantivo nos
  nomes de métodos (R7 #20), TTL repetido num comentário (R6 #3). São reais, mas atrapalham pouco.

#### Coincidências com as ferramentas e com a parte 1

| Problema | Biome | jscpd | madge | LLM | Parte 1 / manual |
|---|---|---|---|---|---|
| `DadosIniciativa.criar` longo e com 13 parâmetros | sim | — | — | R1 #15, #16 | — |
| Bloco repetido em `editar-iniciativa.ts` e `ressubmeter-iniciativa.ts` | — | clone 4 | — | R1 #11 | — |
| Adaptador `iniciativa.adapter.ts` igual em refinamento e votacao | — | clone 1 | — | R7 #6 (o conceito `ParIniciativaCiclo`) | — |
| Limites do domínio repetidos como números nos DTOs | números mágicos | — | — | R1 #22, R2 #5, R3 #2, R5 #11 | — |
| Ciclo entre módulos | — | — | 3 ciclos | R1 #2, R5 #1, R7 #1, #2 e outros | ADR-013 |
| Regra "reprovar exige justificativa" fora da entidade | — | — | — | R1 #31, R7 #16 | candidato da parte 1 |
| Listagem lê a tabela de votacao | — | — | — | R1 #3 | ADR-002 |
| `PERIODICIDADES` duplicada | — | não pegou (1 linha) | — | não pegou | candidato da parte 1 |
| Guard com efeito colateral e dependência da ordem de import | — | — | — | R6 #12, #13 e R7 #19 | — |
| Fachada de iniciativas atende dois tipos de cliente | — | — | — | R1 #1, R7 #8 | — |

#### Triagem

A triagem de cada achado (aceito ou descartado, com o motivo e quem confirmou lendo o código)
é feita pela equipe. A seção 4 traz uma sugestão de consolidação para orientar a escolha.

---

## 3. Leitura manual (sem LLM e sem ferramenta)

Feita por pessoas da equipe, **antes** de ler as respostas da LLM, para que a comparação seja
justa. Para cada módulo, responder às perguntas do documento e anotar o trecho:

| Módulo | Responsabilidade clara? | Expõe detalhes internos? | De quantos módulos depende? | Smells visíveis | Quem leu |
|---|---|---|---|---|---|
| iniciativas | | | divulgacao, identidade, refinamento, votacao (4) | | |
| avaliacao | | | iniciativas (1) | | |
| refinamento | | | identidade, iniciativas (2) | | |
| votacao | | | iniciativas (1) | | |
| divulgacao | | | iniciativas (1) | | |
| identidade | | | nenhum (0) | | |

A coluna de dependências já vem preenchida a partir dos imports (lista no fim de
`llm/contexto/entre-modulos.txt`). `iniciativas` depende de 4 módulos e quase todos dependem
dele.

**Candidatos levantados durante a parte 1** (confirmar ou descartar lendo o código):

| Local | Suspeita | Categoria possível |
|---|---|---|
| `iniciativas/domain/iniciativa.ts` `decidir()` e `avaliacao/domain/decisao.ts` | A regra "reprovar exige justificativa" fica fora da entidade que ela protege | Information hiding, integridade conceitual |
| `divulgacao/domain/periodicidade.ts:1` e `iniciativas/domain/tipos.ts:11` | A lista `PERIODICIDADES` está declarada igual nos dois arquivos | Duplicated Code |
| `iniciativas/infrastructure/persistence/iniciativa-listagem.query.ts` | A ordenação por relevância junta a tabela `votacao_placar`, do módulo votacao | Acoplamento (decisão registrada na ADR-002) |
| Adaptadores de `iniciativas` (votos, sugestões, google-agenda) | Ciclo entre módulos resolvido com `ModuleRef` preguiçoso | Acoplamento, DIP (ADR-013) |
| Constantes de status, tipos e periodicidades × migrations | Precisam ser mantidas em sincronia à mão | Integridade conceitual (ADR-001) |

---

## 4. Consolidação

Depois das três formas, juntar os achados confirmados (cerca de 8, cobrindo propriedades de
projeto, SOLID e smells sempre que possível) em `divida-tecnica.md`, com a coluna "Como foi
encontrado" indicando manual, Biome, jscpd, madge ou LLM (ou mais de uma). Essa coluna é a base
da comparação na reflexão final.

### 4.1 Sugestão de consolidação (a equipe confirma lendo o código)

Escolhidos pelos critérios do documento: impacto concreto, cobertura dos três grupos e, para
os candidatos a refatoração, trecho já coberto pela suíte v2.

| Sugestão | Local | Problema | Categoria | Fontes | Refatorar? |
|---|---|---|---|---|---|
| DT-01 | `divulgacao/domain/periodicidade.ts` e `iniciativas/domain/tipos.ts` | `PERIODICIDADES` declarada igual nos dois módulos; `periodicidade.ts` também guarda `TipoIniciativa` e uma cópia de `FORMATO_CODIGO_TIPO` | Duplicated Code; integridade conceitual; coesão | Manual (parte 1); LLM R5 #3 e #4 | **Sim**: pequeno e coberto pela v2 (US01 periodicidade e US04 recorrência) |
| DT-02 | `iniciativas/domain/value-objects/dados-iniciativa.ts`, `DadosIniciativa.criar` | Método de 84 linhas, complexidade 42, valida 13 campos em sequência; construtor com 13 parâmetros | Long Method; Long Parameter List; SRP | Biome; LLM R1 #15 e #16 | **Sim**: o trecho mais testado da v2 (todos os limites da US01). A assinatura de `criar` fica igual, porque a v1 a usa |
| DT-03 | DTOs de `iniciativas`, `avaliacao`, `refinamento` e `divulgacao` | Limites do domínio (120, 280, 1000, 2000, 62 dias...) repetidos como números nos schemas e textos | Magic Numbers; Duplicated Code | Manual; LLM R1 #22, R2 #5, R3 #2, R5 #11 (corrigido na seção 4.2: o Biome não analisa strings) | **Sim**: Replace Magic Literal, sem mudar comportamento |
| DT-04 | `editar-iniciativa.ts` e `ressubmeter-iniciativa.ts` | Mesmo bloco nos dois casos de uso | Duplicated Code | jscpd; LLM R1 #11 | Opcional (coberto pela lacuna L10 da v2) |
| DT-05 | `iniciativas/domain/iniciativa.ts` `decidir()` e `avaliacao/domain/decisao.ts` | A regra "reprovar exige justificativa" fica fora da entidade que ela protege | Information hiding; coesão | Manual (parte 1); LLM R1 #31, R7 #16 | Não: corrigir acrescenta regra ao domínio (muda comportamento) |
| DT-06 | `iniciativas.module.ts` × `divulgacao`, `refinamento`, `votacao` | Três dependências circulares entre módulos; a com divulgacao existe só por uma função pura (`googleAgendaUrl`) | Acoplamento; DIP | madge; LLM R1 #2, R5 #1, R7 #1 e #2; ADR-013 | Não: trabalho grande e decisão registrada |
| DT-07 | `iniciativas/application/iniciativas.facade.ts` | A mesma fachada atende os outros módulos e os controllers do próprio módulo | ISP; information hiding | LLM R1 #1, R7 #8 | Não |
| DT-08 | `identidade/presentation/http/usuario-sync.guard.ts` e `identidade.module.ts` | Guard com efeito colateral (grava usuário) e que depende da ordem de import em outro arquivo | Integridade conceitual; acoplamento; SRP | LLM R6 #12, #13 e R7 #19 | Não |

Cobertura dos três grupos: propriedades de projeto (DT-01, DT-05, DT-06, DT-07, DT-08), SOLID
(DT-02 SRP, DT-06 DIP, DT-07 ISP, DT-08 SRP) e code smells (DT-01, DT-02, DT-03, DT-04).

As três refatorações sugeridas são de categorias diferentes (duplicação e integridade
conceitual; método longo e SRP; números mágicos) e tocam código coberto pela v2.

**Descartes já registrados:** R2 #11 (ciclo `avaliacao` × `iniciativas` que não existe); as 4
fábricas `useFactory` do `iniciativas.module.ts` apontadas pelo Biome (`useMaxParams`), porque
receber muitas dependências é próprio da injeção de dependência do Nest; os clones 3 e 6 do jscpd
(cabeçalhos de controller), a confirmar.

### 4.2 Validação da equipe (15/11/2026)

A equipe conferiu os 8 itens sugeridos lendo o código. **Todos foram confirmados** e estão em
[`divida-tecnica.md`](divida-tecnica.md), com o mesmo ID.

| Item | Resultado | Decisão |
|---|---|---|
| DT-01 | Confirmado | Refatorar |
| DT-02 | Confirmado | Refatorar |
| DT-03 | Confirmado | Refatorar |
| DT-04 | Confirmado | Registrar, sem refatoração nesta Sprint |
| DT-05 | Confirmado | Não é refatoração: colocar a regra em `Iniciativa.decidir()` muda o comportamento observável (testes passariam de falha para sucesso). Tratar à parte, como correção, com o teste escrito antes |
| DT-06 | Confirmado | Registrar, sem refatoração nesta Sprint |
| DT-07 | Confirmado | Registrar, sem refatoração nesta Sprint |
| DT-08 | Confirmado | Registrar, sem refatoração nesta Sprint |

Critérios usados para escolher DT-02, DT-01 e DT-03 (os três atendem a todos): o problema existe
no código; a mudança preserva o comportamento (refatoração no sentido de Fowler, não correção de
defeito); existe uma forma objetiva de provar que nada mudou; são pequenos e de categorias
diferentes.

**Correções feitas na validação:**

- **Origem do DT-03.** A seção 4.1 atribuía o item também ao Biome. O `noMagicNumbers` não analisa
  o conteúdo de strings, e os limites estão dentro dos textos do Swagger. Dos 11 números do item,
  o Biome só apontou o `default(50)` da listagem de comentários; os outros 16 números que ele
  apontou são códigos HTTP (`@HttpCode`), contas de tempo, paginação e a fórmula de relevância,
  que não fazem parte do item. O DT-03 veio da leitura manual e da LLM.
- **Ocorrências que faltavam no DT-03:** participantes "1 a 100000", "Limite padrão: 50", o
  segundo "62 dias" em `divulgacao.controller.ts` e o "até 60 caracteres" do cadastro de tipos.
- **DT-02:** antes de refatorar, foi conferido que os limites de organizadores, membros e
  participantes já tinham teste de valor-limite (`dados-iniciativa.spec.ts`).

**Triagem dos achados do Biome** (tabela da seção 1.1), a partir dessa validação:

| Achado | Decisão | Motivo |
|---|---|---|
| `dados-iniciativa.ts:85` complexidade 42 e 84 linhas | Aceito (DT-02) | Confirmado lendo o código; refatorado |
| `dados-iniciativa.ts:62` 13 parâmetros | Aceito (DT-02) | Confirmado; construtor privado passou a receber um objeto |
| `iniciativas.module.ts` (4 fábricas `useFactory`) | Descartado | Receber muitas dependências é próprio da injeção de dependência do Nest |
| 17 números mágicos | 1 aceito (no DT-03), 16 descartados | O `default(50)` repetia `LIMITE_PADRAO_COMENTARIOS`. Os outros são códigos HTTP, unidades de tempo nomeadas (`MS_POR_DIA`, `TTL_CACHE_MS`), dias da semana e quinzena na recorrência, paginação e a constante da fórmula de Wilson |
| Demais parâmetros (`iniciativas.facade.ts`, `iniciativa.ts`, `submeter-iniciativa.ts`, `carregar-com-prazos.ts`, `iniciativa.events.ts`, `prisma-tipo.repository.ts`) | Não incluídos nos 8 itens | Fora da consolidação; não avaliados um a um nesta Sprint |
