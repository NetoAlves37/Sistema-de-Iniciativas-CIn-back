Identificação:
LLM: ChatGPT
Modelo: GPT-6
Data: 12/11/2026
Framework: Vitest
Linguagem: TypeScript
Versão da suíte: v1
Rodada 1:
Prompt:
Histórias de usuário
US01 - Como aluno/professor, gostaria de submeter uma proposta de iniciativa.
US02 - Como representante do comitê, gostaria de avaliar/aprovar uma proposta.
US03 - Como aluno/professor ou membro do comitê, gostaria de observar o painel de status.
US04 - Como aluno/professor ou membro do comitê, gostaria de observar o calendário de eventos das iniciativas.
US05 - Como autor, gostaria de editar e ressubmeter uma iniciativa reprovada.
US06 - Como usuário, gostaria de comentar em uma iniciativa em andamento.
Critérios de aceitação
US01 - Submeter uma iniciativa completa
US01 - Submeter uma iniciativa com tipo inválido
US01 - Submeter uma iniciativa sem título
US01 - Submeter uma iniciativa com título acima do limite
US01 - Submeter uma iniciativa sem resumo
US01 - Submeter uma iniciativa com resumo acima do limite
US01 - Submeter uma iniciativa sem detalhe
US01 - Submeter uma iniciativa com detalhe acima do limite
US01 - Submeter uma iniciativa com data inválida
US01 - Submeter iniciativa com término anterior ao início
US01 - Submeter iniciativa com horário inválido
US01 - Submeter iniciativa com local vazio
US01 - Submeter iniciativa com local acima do limite
US01 - Submeter iniciativa com periodicidade inválida
US01 - Submeter iniciativa sem organizadores
US01 - Submeter iniciativa com número de participantes inválido
US01 - Após submissão, iniciativa atualiza no painel
US02 - Avaliar iniciativa após encerramento das etapas anteriores
US02 - Aprovar iniciativa mediante aprovação do avaliador
US02 - Reprovar iniciativa mediante avaliação negativa
US02 - Reprovar iniciativa sem justificativa
US02 - Impedir autor de avaliar própria iniciativa
US02 - Impedir avaliação por usuário sem permissão
US02 - Impedir avaliação fora do status EM_ANALISE
US02 - Após avaliação, iniciativa atualiza no painel
US02 - Iniciativa avaliada não fica disponível novamente para avaliação
US03 - Visualizar iniciativas no painel de status
US03 - Visualizar minhas iniciativas
US03 - Filtrar iniciativas por status
US03 - Visualizar contagem de iniciativas por status
US03 - Após avaliação, atualizar status no painel
US04 - Visualizar iniciativas aprovadas no calendário
US04 - Iniciativas não aprovadas não aparecem no calendário
US04 - Visualizar iniciativas na data determinada
US04 - Visualizar iniciativas recorrentes no calendário
US04 - Consultar calendário com intervalo inválido
US04 - Visualizar iniciativa aprovada com link do Google Agenda
US05 - Editar iniciativa durante refinamento
US05 - Impedir edição por usuário diferente do autor
US05 - Impedir edição fora do refinamento
US05 - Ressubmeter iniciativa reprovada com alterações
US05 - Ressubmeter iniciativa sem alterações
US05 - Impedir ressubmissão por usuário diferente do autor
US05 - Impedir ressubmissão de iniciativa não reprovada
US05 - Ressubmeter iniciativa e incrementar ciclo
US06 - Comentar em iniciativa em andamento
US06 - Comentar em iniciativa após encerramento do refinamento
US06 - Comentar em iniciativa em votação
US06 - Comentar em iniciativa em análise
US06 - Comentar em iniciativa aprovada ou reprovada
US06 - Comentar com texto vazio
US06 - Comentar com texto acima do limite
US06 - Comentar em iniciativa válida
US06 - Comentar em iniciativa inexistente

Código do projeto:
aqui colocamos o arquivo
O projeto utiliza:
TypeScript
Vitest
Gere uma suíte inicial de testes automatizados (v1) para as histórias de usuário US01 a US06.
A suíte deve:
Aplicar técnicas de particionamento de equivalência e análise de valores-limite.
Garantir cobertura dos critérios de aceitação fornecidos.
Identificar, em comentário no código, qual técnica de teste está sendo utilizada e qual requisito/critério de aceitação cada teste cobre.
Utilizar somente métodos, classes, interfaces e funções realmente existentes no código fornecido.
Não inventar APIs, métodos ou comportamentos que não estejam implementados.
Utilizar Vitest e TypeScript, respeitando os padrões do projeto.
Organizar os testes por história de usuário.
Incluir testes positivos e negativos.
Utilizar fixtures, mocks ou objetos auxiliares somente quando necessário e compatíveis com o projeto.
Informar quais critérios de aceitação não puderam ser testados diretamente e explicar o motivo.
Não altere o código de produção.
Entregue os arquivos de teste completos, indicando o caminho de cada arquivo.

Resumo da resposta
A LLM gerou os arquivos de teste para as histórias US01 a US06, com mais ou menos 5 testes para cada user storie.
Problemas observados


Execução da suíte v1
Resultado
Quantidade
Testes passaram


Testes falharam


Testes não compilaram


Total




