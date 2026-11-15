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
| Ferramenta: Biome 2.4.16 | Feita em 15/11/2026 | 32 | (preencher na triagem) | (preencher) |
| Ferramenta: jscpd (duplicação) | Aguardando autorização para `npx` | — | — | — |
| Ferramenta: madge (dependências) | Aguardando autorização para `npx` | — | — | — |
| LLM | Rodadas 1 a 7 abaixo (a fazer) | — | — | — |
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

### 1.2 jscpd e madge (opcionais)

Precisam de `npx`, que baixa os pacotes na primeira execução (não entram no `package.json`).
Comandos previstos:

```bash
npx jscpd@4 src --ignore "**/*.spec.ts,**/testing/**" --reporters console,markdown --output docs/qualidade/ferramentas/jscpd
npx madge@8 --ts-config tsconfig.json --extensions ts --circular src
```

O projeto já tem um teste de arquitetura (`src/architecture.spec.ts`, com ts-morph) que controla
as dependências entre camadas e módulos. Ele pode ser citado como evidência do que já é verificado.

---

## 2. LLM

### 2.1 Identificação (preencher antes da primeira rodada)

- **LLM e modelo:** (ex.: Claude Opus 5.5, ChatGPT GPT-5, Gemini 3 Pro)
- **Interface:** (ex.: claude.ai, chatgpt.com, Copilot no VS Code)
- **Data de uso:**
- **Conversa:** use uma conversa nova para cada rodada, para que a LLM não misture os módulos.

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

### 2.5 Registro de cada rodada (copiar o bloco para as rodadas 1 a 7)

#### Rodada 1: iniciativas

- **Data e hora:**
- **Prompt:** prompt base da seção 2.3 com `<MÓDULO>` = `iniciativas` + `llm/contexto/iniciativas.txt`
- **Resposta completa:** `llm/respostas/rodada-1-iniciativas.md`
- **Resumo da resposta:** (quantos achados e de quais categorias)
- **Problemas observados na resposta:** (trechos inventados, achados genéricos, repetições)

| # da LLM | Achado (resumo) | Decisão | Motivo | Quem confirmou | Vira |
|---|---|---|---|---|---|
| | | aceito / descartado | | | DT-xx / — |

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
