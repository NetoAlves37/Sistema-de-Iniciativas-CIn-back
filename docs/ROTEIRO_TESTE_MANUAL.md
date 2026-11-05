# Roteiro de teste manual

Valida no navegador os 6 fluxos do e2e, com o Keycloak de desenvolvimento. Antes, suba tudo com `COMO_SUBIR_DO_ZERO.md`.

## Preparação

1. Suba a API com **prazos curtos** (item 4 de `COMO_SUBIR_DO_ZERO.md`): refinamento de ≈ 5 min, votação de ≈ 5 min, job a cada 10 s.
2. Use **um navegador com perfis separados** (ou janelas anônimas diferentes) para ficar logado com vários usuários ao mesmo tempo. Endereço: http://localhost:5173/sistema-de-iniciativas/.
3. Usuários (senha = nome de usuário): `ana` (aluno), `bruno` (professor), `diego` (aluno), `carla` e `elisa` (comitê), `admin`.
4. Marque cada passo. Em caso de falha, anote a tela, o usuário e a mensagem.

---

## Fluxo 0 — Login e menu

| # | Passo | Resultado esperado |
|---|---|---|
| 0.1 | Abra o endereço sem estar logado | Tela de login com o botão "Entrar" |
| 0.2 | Clique em "Entrar" e entre como `ana` | Vai para **Início** ("Iniciativas da comunidade"). Nome e perfil "Aluno" aparecem no menu do usuário |
| 0.3 | Abra o menu lateral | Itens: Início, Submeter Iniciativa, Minhas Iniciativas, Iniciativas aprovadas, Calendário. **Sem** "Iniciativas em análise" |
| 0.4 | Entre como `carla` | O menu tem também "Iniciativas em análise"; perfil "Comitê avaliador" |
| 0.5 | Entre como `admin` | Perfil **"Administrador"** (não "Aluno"); menu com "Iniciativas em análise" |
| 0.6 | Como `ana`, tente abrir `/analise` | Tela de acesso negado ("You are logged in as…") |
| 0.7 | Em qualquer tela, olhe o rodapé | Link **Privacidade** abre a página com os dados usados, a finalidade e o contato (placeholder `privacidade@cin.ufpe.br`) |

## Fluxo 1 — Submeter com votação

1. Como `ana`, vá em **Submeter Iniciativa**. A introdução diz "…aberta a sugestões e depois N dia(s) em votação…". O quadro "Enviar para votação geral" está **marcado**.
2. Clique em "Submeter iniciativa" com tudo em branco. **Esperado:** toast "Revise os campos destacados.", foco no primeiro campo e mensagens: "Selecione o tipo.", "Informe o título.", "Escreva uma descrição resumida.", "Escreva a descrição detalhada.", "Informe a data de início.", "Informe a data de término.", "Selecione a periodicidade.", "Informe o espaço utilizado.", "Informe ao menos um organizador.", "Informe um número maior que zero.".
3. Teste as regras de data/hora: término anterior ao início → "A data de término deve ser igual ou posterior à de início."; só a hora de início → "Informe a hora de término ou apague a de início."; hora de término igual à de início → "A hora de término deve ser posterior à de início.".
4. Preencha corretamente (Evento, datas de hoje, "Evento único") e submeta. **Esperado:** toast "Iniciativa submetida e aberta a sugestões" e vai para o detalhe.
5. No detalhe: selo "Em andamento", callout "Aberta a sugestões até <data> (X restantes)", stepper na etapa 1, botão "Editar iniciativa" (você é a autora), **sem** painel de decisão.

## Fluxo 2 — Refinamento, votação, decisão e divulgação (com votação)

1. Como `bruno`, abra a iniciativa da ana (pelo Início, seção "Em andamento"). Escreva uma sugestão e clique "Enviar sugestão". **Esperado:** toast "Sugestão enviada"; aparece com a tag "Professor"; **não** há botão "Editar".
2. Sugestão vazia → "Escreva sua sugestão antes de enviar.".
3. Espere o refinamento acabar (≈ 5 min) e recarregue. **Esperado:** "Em votação", callout "Votação aberta até…", caixa de sugestão substituída por "A fase de sugestões terminou.", e o painel **Interesse da comunidade**.
4. Como `diego`: clique em like → "Voto registrado", botão marcado (`aria-pressed`), "1 voto(s), 100% positivos". Clique de novo → "Voto retirado". Clique em dislike → "Voto registrado"; depois em like → "Voto alterado".
5. Como `ana` (autora), vote também (o autor pode votar).
6. No **Início**, a iniciativa aparece em "Em votação" com ranking e "Encerra em…".
7. Espere a votação acabar (≈ 5 min). **Esperado:** "Em análise", "Aguardando a decisão do comitê avaliador.".
8. Como `carla`, abra **Iniciativas em análise**. **Esperado:** a iniciativa na fila, com mini-votos.
9. Como `elisa`, abra a iniciativa. O painel **Decisão do comitê** aparece. Clique "Aprovar" e confirme em "Confirmar aprovação". **Esperado:** toast "Iniciativa aprovada", selo "Aprovada", callout "Aprovada em… por Elisa Rocha…" e botão **Adicionar ao Google Agenda** (abre o Google Agenda com título, data e local preenchidos).
10. Como `diego`, abra **Iniciativas aprovadas** e busque pelo título. **Esperado:** o cartão aparece. Filtre por outro tipo → "Nenhuma iniciativa aprovada corresponde à busca.".
11. Abra **Calendário**: o evento aparece na data. Clique nele: popover com título, tipo, local, organização e os botões "Ver iniciativa" e "Adicionar ao Google Agenda". **Esc** fecha. Teste as visões Mês, Semana, Dia e Agenda, o filtro por tipo e "Só as minhas iniciativas".
12. Como `ana`, **Minhas iniciativas**: a linha mostra "Aprovada" e "Aprovada em <data>"; os chips de status têm a contagem.

## Fluxo 3 — Sem votação (HU-26)

1. Como `ana`, submeta outra iniciativa **desmarcando** "Enviar para votação geral". Note que a introdução omite a parte da votação.
2. No detalhe: tag **"Sem votação"**; no stepper, "Em votação" aparece riscada ("sem votação").
3. Espere o refinamento acabar (≈ 5 min). **Esperado:** vai **direto** para "Em análise" (sem passar por votação). O histórico (recolhido no fim da página) mostra só "Em andamento" → "Em análise".
4. Como `diego`, tente votar pela API/Swagger (`PUT /iniciativas/:id/voto`) → 409 "A votação desta iniciativa foi encerrada.". Na tela não há botão ativo.
5. Como `carla`, na fila a iniciativa aparece com a tag "Sem votação".

## Fluxo 4 — Reprovação e ressubmissão

1. Como `elisa`, abra a iniciativa sem votação (em análise), clique "Reprovar" e "Confirmar reprovação" **sem justificativa**. **Esperado:** "A justificativa é obrigatória para reprovar.".
2. Escreva a justificativa e confirme. **Esperado:** toast "Iniciativa reprovada"; selo "Reprovada".
3. Como `ana`: o callout mostra "Reprovada em… por Elisa Rocha" e "Justificativa: …", e o botão **"Editar e ressubmeter"**.
4. Clique nele. A tela mostra "Justificativa do comitê" e os campos preenchidos. Altere o título e clique "Ressubmeter iniciativa". **Esperado:** toast "Iniciativa ressubmetida e aberta a sugestões", selo "Em andamento", "Ciclo 2", votos e sugestões do ciclo zerados, e a justificativa anterior no histórico.
5. Como `bruno`, abra a iniciativa que tinha sugestão no ciclo 1: ela continua listada, sob o separador "Ciclo 1 (antes da reprovação)".

## Fluxo 5 — Autorização e conflito de interesse

| # | Passo | Resultado esperado |
|---|---|---|
| 5.1 | `diego` abre `/analise` | Acesso negado |
| 5.2 | `bruno` tenta editar a iniciativa da ana (digite `/iniciativas/<id>/editar`) | Cartão "Nada por aqui" com "Só o autor pode editar esta iniciativa." |
| 5.3 | `carla` submete uma iniciativa **sem votação** e espera chegar à análise | — |
| 5.4 | `carla` abre a própria iniciativa em análise | Painel de decisão **bloqueado** com a mensagem "Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.", botões desabilitados |
| 5.5 | Na fila, `carla` vê a tag **"Você é o autor"** nessa iniciativa | ✔ |
| 5.6 | `elisa` decide a iniciativa da carla | Funciona |
| 5.7 | `admin` decide uma iniciativa de outra pessoa | Funciona (admin decide como o comitê) |
| 5.8 | `admin` tenta decidir a **própria** iniciativa | Bloqueado, com a mesma mensagem de conflito |

## Fluxo 6 — Erros do servidor na tela

1. Abra o detalhe de uma iniciativa em andamento em **duas janelas** (a autora, `ana`, nas duas). Deixe o prazo vencer numa delas e tente "Salvar alterações". **Esperado:** toast com "Iniciativas com status "Em votação" não podem ser editadas." e a tela recarrega.
2. Em duas janelas como `carla` e `elisa`, deixe a mesma iniciativa em análise aberta e clique "Aprovar" quase juntas. **Esperado:** uma aprova; a outra recebe "Esta iniciativa já foi decidida." e a tela recarrega.
3. Abra `/iniciativas/00000000-0000-4000-8000-00000000dead`. **Esperado:** "Nada por aqui".

## Acessibilidade (RNF-02)

1. Navegue **só pelo teclado** (Tab, Shift+Tab, Enter, Espaço, Esc) por: login, formulário, detalhe (votar, comentar, decidir), calendário e popover. O foco deve ser sempre visível e a ordem lógica.
2. Os campos com erro têm borda/mensagem e leitor de tela anuncia o erro. Os botões de voto anunciam o estado (pressionado).
3. Confira o contraste dos selos de status e dos chips de tipo nos temas claro e escuro. O teste automático do jsdom não mede contraste, então **esta conferência é manual**.

## Dados de demonstração

Se rodou `npm run seed`, o Início já mostra as iniciativas de exemplo (em votação, em andamento, aprovadas e uma sem votação), a fila do comitê tem 2 itens e o calendário tem 4 aprovadas. Para recomeçar do zero: `node scripts/prepare-database.mjs BD-SICIN --reset` e `npm run seed`.
