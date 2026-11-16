| **ID** | **Requisito / critério de aceitação** | **Variável** | **Partição ou limite** | **Tipo** | **Caso de teste esperado** | **Coberto pela v1?** | **Coberto pela v2?** | **Lacuna da v2** |
|---|---|---|---|---|---|---|---|---|
| CT-01 | US01 - Submeter uma iniciativa completa | Dados da iniciativa | Todos os campos obrigatórios válidos | Partição | Submeter iniciativa completa → iniciativa criada com status EM_ANDAMENTO | sim | sim | — |
| CT-02 | US01 - Submeter uma iniciativa com tipo inválido | Tipo | Valor diferente de EXTENSAO, PESQUISA ou EVENTO | Partição | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-03 | US01 - Submeter uma iniciativa sem título | Título | 0 (inválido), 1(válido), 120(válido), 121 (inválido) caracteres | Limite | Submeter iniciativa → erro (informe o título) | sim | sim | L11 (asserção fortalecida) |
| CT-04 | US01 - Submeter uma iniciativa com título acima do limite | Título | 0 (inválido), 1(válido), 120(válido), 121 (inválido) caracteres | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-05 | US01 - Submeter uma iniciativa sem resumo | Resumo | 0 (inválido), 1(válido), 280(válido), 281 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-06 | US01 - Submeter uma iniciativa com resumo acima do limite | Resumo | 0 (inválido), 1(válido), 280(válido), 281 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-07 | US01 - Submeter uma iniciativa sem detalhe | Detalhe | 0 (inválido), 1(válido), 5000(válido), 5001 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-08 | US01 - Submeter uma iniciativa com detalhe acima do limite | Detalhe | 0 (inválido), 1(válido), 5000(válido), 5001 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-09 | US01 - Submeter uma iniciativa com data inválida | Datas | Formato inválido ou data inexistente | Partição | Submeter iniciativa → erro de validação | sim | sim | — |
| CT-10 | US01 - Submeter iniciativa com término anterior ao início | Datas | término = início (válido); término 1 dia antes (inválido) | Limite | Submeter iniciativa → erro (data de término deve ser igual ou posterior à de início) | sim | sim | L11 (asserção fortalecida) |
| CT-11 | US01 - Submeter iniciativa com horário inválido | Horários | término = início (10:00) - inválido;           início + 1 min (10:01) - válido | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-12 | US01 - Submeter iniciativa com local vazio | Espaço | 0 (inválido), 1(válido), 200(válido), 201 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-13 | US01 - Submeter iniciativa com local acima do limite | Espaço | 0 (inválido), 1(válido), 200(válido), 201 (inválido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-14 | US01 - Submeter iniciativa com periodicidade inválida | Periodicidade | Valor fora das periodicidades permitidas | Partição | Submeter iniciativa → erro de validação | sim | sim | — |
| CT-15 | US01 - Submeter iniciativa sem organizadores | Organizadores | Campo vazio ou apenas espaços | Partição | Submeter iniciativa → erro de validação | sim | sim | — |
| CT-16 | US01 - Submeter iniciativa com número de participantes inválido | Participantes | 0 (inválido); 1 (válido) | Limite | Submeter iniciativa → erro de validação | sim | sim | L11 (asserção fortalecida) |
| CT-17 | US01 - Após submissão, iniciativa atualiza no painel | Submissão | Iniciativa criada com sucesso | Partição | Submeter iniciativa → iniciativa aparece no painel com status Em andamento | sim | sim | L6 |
| CT-18 | US02 - Avaliar iniciativa após encerramento das etapas anteriores | Status | EM_ANALISE | Partição | Iniciativa em análise → disponível para decisão do comitê | sim | sim | — |
| CT-19 | US02 - Aprovar iniciativa mediante aprovação do avaliador | Decisão | Resultado APROVADA | Partição | Aprovar iniciativa → status atualizado para APROVADA | sim | sim | L13 (pelo caminho real) |
| CT-20 | US02 - Reprovar iniciativa mediante avaliação negativa | Decisão | Resultado REPROVADA com justificativa | Partição | Reprovar iniciativa → status atualizado para REPROVADA e justificativa registrada | sim | sim | L13 (pelo caminho real) |
| CT-21 | US02 - Reprovar iniciativa sem justificativa | Justificativa | Justificativa vazia - undefined, null, vazio e só espaços | Partição | Reprovar iniciativa → erro de validação | sim (os 4 testes falham: chamam o caso de uso sem a validação do módulo avaliacao) | sim | L13 |
| CT-22 | US02 - Impedir autor de avaliar própria iniciativa | Autor e avaliador | Autor = avaliador | Partição | Tentar decidir própria iniciativa → erro de autorização | sim | sim | L13 (pelo caminho real) |
| CT-23 | US02 - Impedir avaliação por usuário sem permissão | Perfil do usuário | Usuário não pertencente ao comitê ou administrador | Partição | Tentar avaliar iniciativa → acesso negado | sim | sim | L7 |
| CT-24 | US02 - Impedir avaliação fora do status EM_ANALISE | Status | Status diferente de EM_ANALISE | Partição | Tentar decidir iniciativa → erro de transição inválida | sim | sim | L13 (pelo caminho real) |
| CT-25 | US02 - Após avaliação, iniciativa atualiza no painel | Status | APROVADA ou REPROVADA | Partição | Avaliar iniciativa → status atualizado no painel | sim | sim | L7 |
| CT-26 | US02 - Iniciativa avaliada não fica disponível novamente para avaliação | Status | APROVADA ou REPROVADA | Partição | Avaliar iniciativa → iniciativa deixa de aparecer na fila de análise | sim | sim | L13 (pelo caminho real) |
| CT-27 | US03 - Visualizar iniciativas no painel de status | Status | Diferentes status existentes | Partição | Consultar painel → iniciativas exibidas com seus status | não | sim | L1 |
| CT-28 | US03 - Visualizar minhas iniciativas | Autor | Autor = usuário autenticado | Partição | Consultar minhas iniciativas → propostas do usuário são exibidas | não | sim | L1 |
| CT-29 | US03 - Filtrar iniciativas por status | Status | Status válido selecionado | Partição | Aplicar filtro → iniciativas correspondentes são exibidas | não | sim | L1 |
| CT-30 | US03 - Visualizar contagem de iniciativas por status | Status | Iniciativas cadastradas pelo autor | Partição | Consultar minhas iniciativas → contagem por status apresentada | não | sim | L1 |
| CT-31 | US03 - Após avaliação, atualizar status no painel | Status | Iniciativa decidida | Partição | Avaliar iniciativa → painel apresenta status atualizado | não | sim | L1, L7 |
| CT-32 | US04 - Visualizar iniciativas aprovadas no calendário | Status | APROVADA | Partição | Consultar calendário → iniciativas aprovadas são exibidas | não | sim | L2 |
| CT-33 | US04 - Iniciativas não aprovadas não aparecem no calendário | Status | EM_ANDAMENTO, EM_VOTACAO, EM_ANALISE ou REPROVADA | Partição | Consultar calendário → iniciativa não aprovada não é exibida | não | sim | L2 (teste de integração) |
| CT-34 | US04 - Visualizar iniciativas na data determinada | Data | Data dentro do intervalo consultado | Partição | Consultar calendário → iniciativa aparece na data correspondente | não | sim | L2 |
| CT-35 | US04 - Visualizar iniciativas recorrentes no calendário | Periodicidade | DIARIA, SEMANAL, QUINZENAL ou MENSAL | Partição | Consultar calendário → ocorrências são geradas conforme periodicidade | não | sim | L2 |
| CT-36 | US04 - Consultar calendário com intervalo inválido | Intervalo | 62 dias (válido); 63 dias (inválido) | Limite | Consultar calendário → erro de validação | não | sim | L4 |
| CT-37 | US04 - Visualizar iniciativa aprovada com link do Google Agenda | Iniciativa aprovada | Status APROVADA | Partição | Consultar detalhes → link para adicionar ao Google Agenda é disponibilizado | não | sim | L2 |
| CT-38 | US05 - Editar iniciativa durante refinamento | Autor e status | Autor = usuário e status EM_ANDAMENTO | Partição | Editar iniciativa → alterações permitidas | sim | sim | L10 (pelo caso de uso) |
| CT-39 | US05 - Impedir edição por usuário diferente do autor | Autor | Autor ≠ usuário autenticado | Partição | Tentar editar iniciativa → erro de autorização | sim | sim | L10 (pelo caso de uso) |
| CT-40 | US05 - Impedir edição fora do refinamento | Status | Status diferente de EM_ANDAMENTO | Partição | Tentar editar iniciativa → erro de transição inválida | sim | sim | L10 (pelo caso de uso) |
| CT-41 | US05 - Ressubmeter iniciativa reprovada com alterações | Dados e status | Status REPROVADA e dados válidos | Partição | Ressubmeter iniciativa → dados atualizados e status EM_ANDAMENTO | sim | sim | L10 (pelo caso de uso) |
| CT-42 | US05 - Ressubmeter iniciativa sem alterações | Dados da iniciativa | Dados iguais aos anteriores | Partição | Ressubmeter iniciativa → aceita (decisão da dona do produto em 15/11/2026: a HU-06 não exige alteração, ver nota 1) | sim | sim | L10 (pelo caso de uso) |
| CT-43 | US05 - Impedir ressubmissão por usuário diferente do autor | Autor | Autor ≠ usuário autenticado | Partição | Tentar ressubmeter iniciativa → erro de autorização | sim | sim | L10 (pelo caso de uso) |
| CT-44 | US05 - Impedir ressubmissão de iniciativa não reprovada | Status | Status diferente de REPROVADA | Partição | Tentar ressubmeter iniciativa → erro de transição inválida | sim | sim | L10 (pelo caso de uso) |
| CT-45 | US05 - Ressubmeter iniciativa e incrementar ciclo | Ciclo | Ciclo anterior + 1 | Partição | Ressubmeter iniciativa → ciclo incrementado e refinamento reaberto | sim | sim | — |
| CT-46 | US06 - Comentar em iniciativa em andamento | Status e prazo | EM_ANDAMENTO e refinamento aberto | Partição | Comentar iniciativa → comentário publicado | sim | sim | — |
| CT-47 | US06 - Comentar em iniciativa após encerramento do refinamento | Status e prazo | Refinamento encerrado. Limite do prazo: 1 ms antes do fim (aceita) e o instante exato do fim (recusa) | Partição (com limite) | Comentar iniciativa → erro (fase de sugestões encerrada) | sim | sim | L12 |
| CT-48 | US06 - Comentar em iniciativa em votação | Status | EM_VOTACAO | Partição | Comentar iniciativa → erro (fase de sugestões encerrada) | sim | sim | — |
| CT-49 | US06 - Comentar em iniciativa em análise | Status | EM_ANALISE | Partição | Comentar iniciativa → erro (fase de sugestões encerrada) | sim | sim | — |
| CT-50 | US06 - Comentar em iniciativa aprovada ou reprovada | Status | APROVADA ou REPROVADA | Partição | Comentar iniciativa → erro (fase de sugestões encerrada) | sim | sim | — |
| CT-51 | US06 - Comentar com texto vazio | Texto do comentário | 0 (inválido), 1(válido), 1000(válido), 1001 (inválido) caracteres | Limite | Comentar iniciativa → erro (escreva sua sugestão antes de enviar) | não | sim | L5 |
| CT-52 | US06 - Comentar com texto acima do limite | Texto do comentário | 0 (inválido), 1(válido), 1000(válido), 1001 (inválido) caracteres | Limite | Comentar iniciativa → erro de validação | não | sim | L5 |
| CT-53 | US06 - Comentar em iniciativa válida | Texto do comentário | 0 (inválido), 1(válido), 1000(válido), 1001 (inválido) caracteres | Limite | Comentar iniciativa → comentário salvo e retornado | não | sim | L3, L5 |
| CT-54 | US06 - Comentar em iniciativa inexistente | Identificador da iniciativa | ID não existente | Partição | Comentar iniciativa → erro (iniciativa não encontrada) | não | sim | L3 |

**Nota 1 (ressubmeter sem alterações).** A HU-06 (SCRUM-49) e a RN-11 não dizem se a
ressubmissão precisa trazer alguma alteração. A versão de 10/11 desta matriz esperava "recusa";
a de 12/11 passou a esperar "aceita conforme regra atual do backend", ou seja, o oráculo foi
tirado do código, e a mesma frase entrou no prompt da v1. Em 15/11/2026 a dona do produto
decidiu que ressubmeter com os mesmos dados **é permitido**: a aprovação depende do comitê, e
uma ideia reprovada num ciclo pode ser aprovada em outro sem mudar nada; a ressubmissão continua
restrita ao autor e ao status Reprovada, então não há risco de segurança. O oráculo "aceita"
passa a ter origem no requisito, e o caso não é um defeito.

**Nota 2 (contagem).** Cada linha é um caso de teste (CT-01 a CT-54). A coluna "Tipo" separa as
linhas de partição de equivalência (39) das linhas de valor-limite (15). As 15 linhas de limite
somam 30 valores-limite (lista em `relatorios/v1/v1.md`); o CT-47 é uma partição que também
carrega os 2 limites do prazo do refinamento. Com isso:

| Indicador | v1 | v2 |
|---|---|---|
| Requisitos (linhas com teste) | 39 de 54 (72,2%); 38 de 54 sem o CT-21 | 54 de 54 (100%) |
| Partições (linhas de partição com teste) | 28 de 39 (71,8%); 27 de 39 (69,2%) sem o CT-21 | 39 de 39 (100%) |
| Valores-limite | 24 de 30 (80%) | 30 de 30 (100%) |

O CT-21 (reprovar sem justificativa) tem 4 testes na v1, mas os 4 falham por erro de setup
(camada errada), por isso os números aparecem com e sem ele.

**Nota 3 (lacunas da v2).** A coluna "Lacuna da v2" diz qual lacuna da análise da v1 cada caso
resolveu. "—" quer dizer que a v1 já cobria o caso e a v2 só o manteve.

| Lacuna | O que faltava na v1 | Onde a v2 resolve |
|---|---|---|
| L1 | US03 inteira (painel, minhas iniciativas, filtro e contagem por status) | `tests/v2/us03-painel-consultas.spec.ts` |
| L2 | US04: aprovadas no intervalo, recorrência, intervalo inválido e link do Google Agenda | `tests/v2/us04-calendario-recorrencia.spec.ts`; "não aprovadas não aparecem" por teste de integração |
| L3 | US06: comentário válido salvo e iniciativa inexistente | `tests/v2/us06-comentarios.spec.ts` |
| L4 | US04: limites do intervalo (62 dias válido, 63 inválido) | `tests/v2/us04-calendario-recorrencia.spec.ts` |
| L5 | US06: limites do texto (0, 1, 1000 e 1001 caracteres) | `tests/v2/us06-comentarios.spec.ts` |
| L6 | US01: após a submissão, a iniciativa aparece no painel | `tests/v2/lacunas-restantes.spec.ts` |
| L7 | US02: acesso negado a quem não é do comitê; painel atualizado após avaliar | `tests/v2/us02-acesso-negado.spec.ts` e `lacunas-restantes.spec.ts` |
| L8 | Branch não coberto: decisão concorrente em `decidir-iniciativa.ts` | `tests/v2/lacunas-restantes.spec.ts` (não é linha da matriz: é branch de código) |
| L9 | Branch não coberto: iniciativa inexistente em `alterar-iniciativa.ts` | `tests/v2/lacunas-restantes.spec.ts` (branch de código) |
| L10 | US05 testada só no domínio, não pelos casos de uso `EditarIniciativa` e `RessubmeterIniciativa` | `tests/v2/lacunas-restantes.spec.ts` |
| L11 | 16 testes da v1 só com `not.toThrow()` | Cópia corrigida da v1 em `tests/v2/iniciativas.regras-de-negocio.spec.ts` |
| L12 | Limite do fim do refinamento tirado do código, não do requisito | Decisão da equipe registrada no teste (CT-47) |
| L13 | US02 testada fora do caminho real (`RegistrarDecisao`), o que causou as 4 falhas da justificativa | `tests/v2/us02-registrar-decisao.spec.ts` |
