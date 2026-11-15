# Dívida técnica (Sprint 3, parte 2)

Itens de dívida técnica do backend, **confirmados pela equipe lendo o código** em 15/11/2026.
Como cada um foi procurado (ferramentas, LLM e leitura manual), com os prompts e os achados
descartados, está em [`log-analise.md`](log-analise.md). As execuções de teste antes e depois de
cada refatoração estão em [`execucoes.md`](execucoes.md).

- **Código analisado:** commit `b1352d3` (igual ao da tag `sprint3-parte1-medicao`), mais a
  regra de submissão repetida (`245eff6`), que não mexeu em nenhum dos trechos abaixo.
- **Validação:** os 8 itens sugeridos na consolidação (seção 4.1 do log) foram conferidos no
  código pela equipe. **Todos foram confirmados.**
- **Refatorados nesta Sprint:** DT-02, DT-01 e DT-03 (nessa ordem).

## Itens

| ID | Local (arquivo e função/classe) | Problema | Categoria | Por que isso atrapalha | Como foi encontrado | Status |
|---|---|---|---|---|---|---|
| DT-01 | `iniciativas/domain/tipos.ts` e `divulgacao/domain/periodicidade.ts`: constantes `PERIODICIDADES` e `FORMATO_CODIGO_TIPO`, tipos `Periodicidade` e `TipoIniciativa` | As quatro declarações estão iguais nos dois módulos; a regex duplicada não tem ligação de tipo nenhuma, e `periodicidade.ts` guarda coisas que não são periodicidade | Duplicated Code; integridade conceitual; coesão | Se as cópias divergirem, nada avisa: um código de tipo aceito num módulo pode ser recusado no outro | Leitura manual (parte 1); LLM (R5 #3 e #4) | Refatorado (`d767cb8`) |
| DT-02 | `iniciativas/domain/value-objects/dados-iniciativa.ts`: `DadosIniciativa.criar()` e o construtor de `DadosIniciativa` | Método de 84 linhas e complexidade cognitiva 42 (limite 15), o pior caso de `src/`, validando 13 campos em sequência; construtor com 13 parâmetros posicionais | Long Method; Long Parameter List; SRP | É onde nascem todas as regras de campo da US01 (RN-01 e RN-02): qualquer regra nova exige entender o método inteiro, e é fácil errar a ordem dos 13 argumentos | Ferramenta (Biome: complexidade, linhas e parâmetros); LLM (R1 #15 e #16) | Refatorado (`4cda5d4`) |
| DT-03 | `iniciativas.dto.ts` (`DadosIniciativaSchema`), `tipos-iniciativa.dto.ts` (`CadastrarTipoSchema`), `avaliacao.dto.ts` (`RegistrarDecisaoSchema`), `comentario.dto.ts` (`CriarComentarioSchema`, `ListarComentariosQuerySchema`), `comentarios.controller.ts` (`listar`, `comentar`), `divulgacao.dto.ts` (`OcorrenciasQuerySchema`) e `divulgacao.controller.ts` (`ocorrencias`) | Limites do domínio escritos à mão nos textos do Swagger (120, 280, 5000, 200, 500, 100000, 2000, 1000, 50, 62 dias, 60) | Magic Numbers; Duplicated Code | Se um limite mudar, a regra muda mas a documentação da API continua com o número antigo, e o front é induzido ao erro | Leitura manual e LLM (R1 #22, R2 #5, R3 #2, R5 #11). O `noMagicNumbers` do Biome não analisa o conteúdo de strings: dos 11 números, só pegou o `default(50)` | Refatorado (`410e03c`) |
| DT-04 | `iniciativas/application/use-cases/editar-iniciativa.ts` e `ressubmeter-iniciativa.ts`: `EditarIniciativa.executar()` e `RessubmeterIniciativa.executar()` | O mesmo bloco (montar os dados e liberar o tipo atual) repetido nos dois casos de uso, inclusive o comentário | Duplicated Code | Mudar a regra "o tipo atual continua valendo" exige lembrar dos dois lugares; esquecer um faz editar e ressubmeter se comportarem diferente | Ferramenta (jscpd, clone de 10 linhas); LLM (R1 #11) | Aberto |
| DT-05 | `iniciativas/domain/iniciativa.ts`: `Iniciativa.decidir()`; `avaliacao/domain/decisao.ts`: `validarDecisao()` | A regra "reprovar exige justificativa" fica no módulo `avaliacao`, fora da entidade que guarda a decisão | Information hiding; coesão | Qualquer caminho novo até `decidir()` pode gravar uma reprovação sem justificativa (foi o que levou às 4 falhas da v1 na US02) | Leitura manual (parte 1); LLM (R1 #31, R7 #16) | Aberto (é correção, não refatoração: ver abaixo) |
| DT-06 | `iniciativas/iniciativas.module.ts`: `IniciativasModule` × `DivulgacaoModule`, `RefinamentoModule` e `VotacaoModule` | Três dependências circulares entre módulos, contornadas com `forwardRef` e `ModuleRef`; a com `divulgacao` existe só por uma função pura (`googleAgendaUrl`) | Acoplamento; DIP | Nenhum dos quatro módulos pode ser testado ou reaproveitado sozinho, e a ordem de inicialização do Nest fica frágil | Ferramenta (madge, 3 ciclos); LLM (R1 #2, R5 #1, R7 #1 e #2); já registrado na ADR-013 | Aberto |
| DT-07 | `iniciativas/application/iniciativas.facade.ts`: `IniciativasFacade` | A mesma fachada atende os outros módulos (3 ou 4 métodos) e os controllers do próprio módulo (o resto): quem a importa enxerga os 13 métodos | ISP; information hiding | Nada impede outro módulo de chamar `submeter` ou `aplicarPrazosVencidos` sem passar pelas regras da API | LLM (R1 #1, R7 #8). Nenhuma ferramenta aponta | Aberto |
| DT-08 | `identidade/presentation/http/usuario-sync.guard.ts`: `UsuarioSyncGuard`; `identidade/identidade.module.ts`: `IdentidadeModule` | Guard que sempre deixa passar e é usado para gravar o usuário no banco; só funciona se o módulo for importado depois do de autenticação | Integridade conceitual; acoplamento; SRP | Reorganizar os imports do `AppModule` quebra a sincronização de usuários sem nenhum erro; a restrição só existe num comentário | LLM (R6 #12 e #13, R7 #19). Nenhuma ferramenta aponta | Aberto |

Cobertura dos três grupos pedidos: propriedades de projeto (DT-01, DT-05, DT-06, DT-07, DT-08),
SOLID (DT-02 SRP, DT-06 DIP, DT-07 ISP, DT-08 SRP) e code smells (DT-01, DT-02, DT-03, DT-04).

## Critérios para escolher o que refatorar

Os três itens escolhidos atendem a todos os critérios:

1. O problema existe no código (confirmado lendo o código).
2. A mudança preserva o comportamento: é refatoração no sentido de Fowler, não correção de defeito.
3. Existe uma forma objetiva de provar que nada mudou.
4. São pequenos e de categorias diferentes (método longo; duplicação e coesão; números mágicos).

Justificativa de cada um, em uma frase:

- **DT-02:** é o item que mais atrapalha mudanças futuras (todas as regras de campo da US01
  nascem nesse método) e o trecho mais testado do sistema, então dá para mudar com segurança.
- **DT-01:** a duplicação pode divergir sem nenhum aviso, e a mudança é só mover declarações com
  valores idênticos, coberta pelo compilador e pelo teste de arquitetura.
- **DT-03:** a documentação da API pode mentir para o front sem ninguém perceber, e há uma prova
  objetiva de que nada mudou (o `openapi.json` exportado antes e depois sai idêntico).

**DT-05 não é refatoração, é correção.** Colocar a validação em `Iniciativa.decidir()` muda o
comportamento observável: o resultado de testes existentes passaria de falha para sucesso (as 4
falhas da v1 na US02). Deve ser tratado à parte, com o teste escrito antes da correção.

DT-04, DT-06, DT-07 e DT-08 são dívidas confirmadas e ficam registradas para as próximas Sprints.

## Refatorações feitas

Regras seguidas em todas: as suítes v1 (`tests/v1-llm/`) e v2 (`tests/v2/`) não foram editadas;
`npm test` (que inclui a v2) e `npm run test:v1` rodaram antes e depois de cada item, com o mesmo
resultado; um commit por item, para revisar e reverter cada um isoladamente.

### DT-02: método longo em `DadosIniciativa.criar` (commit `4cda5d4`)

- **Técnicas:** Extract Function por grupo de campos (`validarTipo`, `validarTexto`,
  `validarDatas`, `validarHorario`, `validarPeriodicidade`, `validarParticipantes`; as regras dos
  6 campos de texto viraram uma tabela) e Introduce Parameter Object no construtor privado.
- **O que ficou igual:** a assinatura de `criar` (a v1 e a v2 a usam), as mensagens, a ordem dos
  erros e o acúmulo de todos eles num único `ValidacaoError`.
- **Proteção:** a v2 testa os valores-limite de título, resumo, detalhe e espaço, e
  `dados-iniciativa.spec.ts` já cobria os limites de organizadores, membros e participantes.
  Antes de refatorar, foram acrescentados 15 testes de caracterização em `src/` (commit
  `c69bc76`): mensagens exatas de limite, ordem dos erros acumulados, combinações de datas e horas
  que dependem da ordem das verificações, normalização dos campos e `comDatas`.
- **Medição (Biome):** antes, complexidade 42, 84 linhas e 13 parâmetros. Depois, nenhuma função
  do arquivo passa dos limites (15 de complexidade, 50 linhas, 4 parâmetros).

### DT-01: tipos e periodicidades duplicados (commit `d767cb8`)

- **Técnica:** Move Declarations para uma fonte única, `src/shared/domain/vocabulario-iniciativa.ts`,
  importada pelos dois módulos. Um módulo continua sem importar o domínio do outro, o que violaria
  as regras 1 e 4 do `src/architecture.spec.ts`. Os dois arquivos antigos foram removidos.
- **Proteção:** os valores são idênticos. Cobrem a mudança o compilador, o teste de arquitetura e
  os testes de recorrência, de Google Agenda e de formato do código de tipo.
- **Limite da refatoração:** as periodicidades também existem na tabela
  `iniciativas_periodicidades` (migration). Criar uma periodicidade nova continua exigindo uma
  mudança coordenada; a refatoração elimina só a duplicação no código TypeScript.
- **Observação:** `ROTULO_PERIODICIDADE` foi junto para a fonte única, mas não é usado em lugar
  nenhum do backend. Apagá-lo seria outra mudança, que fica registrada aqui.

### DT-03: limites escritos à mão nos textos da API (commit `410e03c`)

- **Técnica:** Replace Magic Literal. Os textos passam a ser montados com as constantes que já
  existiam (`LIMITES`, `LIMITE_JUSTIFICATIVA`, `TEXTO_MAXIMO`, `LIMITE_PADRAO_COMENTARIOS`,
  `MAXIMO_DIAS_INTERVALO` e `LIMITE_NOME_TIPO`), como o mesmo DTO já fazia com `PERIODICIDADES`.
  Incluídas as ocorrências que a medição tinha deixado de fora: participantes "1 a 100000",
  "Limite padrão: 50" (e o `default(50)` da mesma listagem), o segundo "62 dias" em
  `divulgacao.controller.ts` e o "até 60 caracteres" do cadastro de tipos.
- **Proteção:** o `openapi.json` exportado antes e depois (`npm run openapi:export`) saiu
  **idêntico byte a byte** (mesmo SHA-256). Como mexe na camada HTTP, também rodaram a integração
  (94/94) e o e2e (42/42).
- **Fora do item:** o `max(500)` da paginação não tem constante no domínio e ficou como está.

## Medição das ferramentas antes e depois

Mesmos comandos do `log-analise.md`, no mesmo escopo (`src/modules` e `src/shared`, sem testes).

| Ferramenta | Antes (`b1352d3`) | Depois (`410e03c`) |
|---|---|---|
| Biome, complexidade cognitiva > 15 | 1 | 0 |
| Biome, funções com mais de 50 linhas | 1 | 0 |
| Biome, mais de 4 parâmetros | 13 | 12 |
| Biome, números mágicos | 17 | 16 |
| jscpd, clones | 7 | 7 (o DT-01 não aparecia como clone) |
| madge, ciclos | 3 | 3 (são o DT-06, não refatorado) |
