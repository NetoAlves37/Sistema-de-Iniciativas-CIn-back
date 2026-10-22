import { TransicoesJob } from '../src/modules/iniciativas/infrastructure/scheduler/transicoes.job';
import { createTestApp, type TestApp } from './support/create-app';

/**
 * E2E dos fluxos de negócio (docs/PROMPT.md, seção 5.1): aplicação real, Postgres real,
 * `TestIdentitySource` e `FakeClock`. O tempo é controlado com `clock.advanceDays` e as
 * transições por prazo são disparadas com `job.executarAgora()`.
 */
describe('E2E: fluxos de iniciativas', () => {
  let t: TestApp;
  let job: TransicoesJob;

  beforeAll(async () => {
    t = await createTestApp();
    job = t.app.get(TransicoesJob);
  });

  afterAll(async () => {
    await t.close();
  });

  const titulo = () => `Iniciativa ${crypto.randomUUID().slice(0, 8)}`;

  const corpo = (sobrescritas: Record<string, unknown> = {}) => ({
    tipo: 'EVENTO',
    titulo: titulo(),
    resumo: 'Maratona de 24h para criar soluções acessíveis.',
    detalhe: 'Equipes de até 5 pessoas desenvolvem protótipos acessíveis.',
    inicio: '2026-12-01',
    fim: '2026-12-03',
    horaInicio: '09:00',
    horaFim: '18:00',
    periodicidade: 'DIARIA',
    espaco: 'Auditório do CIn',
    organizadores: 'Bruno Lima',
    participantes: 40,
    comVotacao: true,
    ...sobrescritas,
  });

  type Usuario = 'ana' | 'bruno' | 'carla' | 'diego' | 'elisa' | 'admin';

  async function submeter(autor: Usuario, sobrescritas: Record<string, unknown> = {}) {
    const resposta = await (await t.req(autor)).post('/iniciativas').send(corpo(sobrescritas));
    expect(resposta.status).toBe(201);
    return resposta.body.data as { id: string; titulo: string; status: string };
  }

  async function detalhe(usuario: Usuario, id: string) {
    const resposta = await (await t.req(usuario)).get(`/iniciativas/${id}`);
    expect(resposta.status).toBe(200);
    return resposta.body.data;
  }

  /** Avança o relógio e roda o job (como se o cron tivesse disparado). */
  async function avancar(dias: number) {
    t.clock.advanceDays(dias);
    await job.executarAgora();
  }

  async function levarParaAnalise(id: string, comVotacao = true) {
    await avancar(3.01);
    if (comVotacao) await avancar(3.01);
    expect((await detalhe('ana', id)).status).toBe('EM_ANALISE');
  }

  describe('autenticação (fluxo 1)', () => {
    it('as rotas de negócio exigem token (401)', async () => {
      expect((await (await t.req()).get('/iniciativas')).status).toBe(401);
      expect((await (await t.req()).get('/avaliacao/fila')).status).toBe(401);
    });
  });

  describe('fluxo 2: ciclo completo com votação até a aprovação', () => {
    it('ana submete → bruno comenta → votação → voto/troca/retirada → análise → carla aprova → divulgação', async () => {
      // ana submete
      const criada = await submeter('ana');
      expect(criada).toMatchObject({ status: 'EM_ANDAMENTO' });
      const novo = await detalhe('ana', criada.id);
      expect(novo).toMatchObject({
        ciclo: 1,
        comVotacao: true,
        autor: { nome: 'Ana Souza', perfil: 'ALUNO' },
        permissoes: { podeEditar: true, podeComentar: true, podeVotar: false, podeDecidir: false },
        googleAgendaUrl: null,
      });
      // o prazo de refinamento é agora + 3 dias (RN-03)
      expect(new Date(novo.fimRefinamento).getTime() - t.clock.now().getTime()).toBe(
        3 * 86_400_000,
      );

      // bruno comenta
      const comentario = await (await t.req('bruno'))
        .post(`/iniciativas/${criada.id}/comentarios`)
        .send({ texto: 'Sugiro incluir um encontro final.' });
      expect(comentario.status).toBe(201);
      const lista = await (await t.req('diego')).get(`/iniciativas/${criada.id}/comentarios`);
      expect(lista.body.data.items).toHaveLength(1);
      expect(lista.body.data.items[0]).toMatchObject({
        ciclo: 1,
        texto: 'Sugiro incluir um encontro final.',
        autor: { nome: 'Bruno Lima', perfil: 'PROFESSOR', ehAutorDaIniciativa: false },
      });
      expect((await detalhe('ana', criada.id)).sugestoesCicloAtual).toBe(1);

      // votar antes da votação: 409
      const cedo = await (await t.req('diego'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: 1 });
      expect(cedo.status).toBe(409);

      // fim do refinamento → EM_VOTACAO
      await avancar(3.01);
      const emVotacao = await detalhe('diego', criada.id);
      expect(emVotacao.status).toBe('EM_VOTACAO');
      expect(emVotacao.permissoes).toMatchObject({ podeVotar: true, podeComentar: false });

      // comentar agora: 409 (RN-05.3)
      const tarde = await (await t.req('bruno'))
        .post(`/iniciativas/${criada.id}/comentarios`)
        .send({ texto: 'Fora de prazo' });
      expect(tarde.status).toBe(409);
      expect(tarde.body.detail).toBe('A fase de sugestões terminou.');

      // diego vota like; ana vota dislike, troca para like e depois retira
      const diego = await (await t.req('diego'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: 1 });
      expect(diego.body.data).toMatchObject({
        meuVoto: 1,
        likes: 1,
        dislikes: 0,
        acao: 'REGISTRADO',
      });
      const anaDislike = await (await t.req('ana'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: -1 });
      expect(anaDislike.body.data).toMatchObject({
        meuVoto: -1,
        likes: 1,
        dislikes: 1,
        acao: 'REGISTRADO',
      });
      const anaTroca = await (await t.req('ana'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: 1 });
      expect(anaTroca.body.data).toMatchObject({
        meuVoto: 1,
        likes: 2,
        dislikes: 0,
        acao: 'ALTERADO',
      });
      const anaRetira = await (await t.req('ana'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: 1 });
      expect(anaRetira.body.data).toMatchObject({
        meuVoto: 0,
        likes: 1,
        dislikes: 0,
        acao: 'RETIRADO',
      });
      await (await t.req('ana')).put(`/iniciativas/${criada.id}/voto`).send({ valor: 1 });

      const comVotos = await detalhe('diego', criada.id);
      expect(comVotos.meuVoto).toBe(1);
      expect(comVotos.votos).toMatchObject({ likes: 2, dislikes: 0 });
      expect(comVotos.votos.relevancia).toBeGreaterThan(0);

      // fim da votação → EM_ANALISE
      await avancar(3.01);
      expect((await detalhe('carla', criada.id)).status).toBe('EM_ANALISE');

      // carla vê a fila e aprova
      const fila = await (await t.req('carla')).get('/avaliacao/fila?limit=100');
      expect(fila.status).toBe(200);
      const naFila = fila.body.data.items.find((i: { id: string }) => i.id === criada.id);
      expect(naFila).toMatchObject({ souAutor: false, votos: { likes: 2 } });

      const painel = await detalhe('carla', criada.id);
      expect(painel.permissoes.podeDecidir).toBe(true);

      const aprovada = await (await t.req('carla'))
        .post(`/avaliacao/${criada.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(aprovada.status).toBe(200);
      expect(aprovada.body.data).toMatchObject({
        status: 'APROVADA',
        decisao: { resultado: 'APROVADA', decisor: { nome: 'Carla Menezes' } },
      });
      expect(aprovada.body.data.googleAgendaUrl).toContain(
        'https://calendar.google.com/calendar/render?',
      );

      // divulgação: aprovadas e calendário
      const aprovadas = await (await t.req('diego')).get(
        `/divulgacao/aprovadas?q=${encodeURIComponent(criada.titulo)}`,
      );
      expect(aprovadas.body.data.items.map((i: { id: string }) => i.id)).toEqual([criada.id]);

      const ocorrencias = await (await t.req('diego')).get(
        '/divulgacao/ocorrencias?de=2026-12-01&ate=2026-12-10',
      );
      const dela = ocorrencias.body.data.filter(
        (o: { iniciativaId: string }) => o.iniciativaId === criada.id,
      );
      expect(dela).toHaveLength(3);
      expect(dela[0]).toMatchObject({
        titulo: criada.titulo,
        diaInteiro: false,
        inicio: '2026-12-01T09:00',
        fim: '2026-12-01T18:00',
      });

      const minhas = await (await t.req('ana')).get('/iniciativas/minhas?status=APROVADA');
      expect(minhas.body.data.items.map((i: { id: string }) => i.id)).toContain(criada.id);
      expect(minhas.body.data.meta.contagemPorStatus.APROVADA).toBeGreaterThanOrEqual(1);

      // histórico do ciclo
      const historico = await (await t.req('diego')).get(`/iniciativas/${criada.id}/historico`);
      expect(historico.body.data.map((h: { para: string }) => h.para).reverse()).toEqual([
        'EM_ANDAMENTO',
        'EM_VOTACAO',
        'EM_ANALISE',
        'APROVADA',
      ]);
      expect(historico.body.data[0]).toMatchObject({
        por: 'Carla Menezes',
        nota: 'Aprovada pelo comitê',
      });
      expect(historico.body.data[2]).toMatchObject({ por: 'Sistema' });
    });
  });

  describe('fluxo 3: sem votação (HU-26)', () => {
    it('vai direto para Em análise sem passar por Em votação, e o voto recebe 409', async () => {
      const criada = await submeter('ana', { comVotacao: false });
      expect((await detalhe('ana', criada.id)).comVotacao).toBe(false);

      await avancar(3.01);
      const aposRefinamento = await detalhe('ana', criada.id);
      expect(aposRefinamento.status).toBe('EM_ANALISE');
      expect(aposRefinamento.fimVotacao).toBeNull();

      const historico = await (await t.req('ana')).get(`/iniciativas/${criada.id}/historico`);
      const estados = historico.body.data.map((h: { para: string }) => h.para);
      expect(estados).not.toContain('EM_VOTACAO');
      expect(estados).toContain('EM_ANALISE');

      const voto = await (await t.req('diego'))
        .put(`/iniciativas/${criada.id}/voto`)
        .send({ valor: 1 });
      expect(voto.status).toBe(409);
      expect(voto.body.detail).toBe('A votação desta iniciativa foi encerrada.');

      const fila = await (await t.req('carla')).get('/avaliacao/fila?limit=100');
      const item = fila.body.data.items.find((i: { id: string }) => i.id === criada.id);
      expect(item).toMatchObject({
        comVotacao: false,
        votos: { likes: 0, dislikes: 0, relevancia: 0 },
      });
    });

    it('nunca aparece nas listas de votação', async () => {
      const criada = await submeter('ana', { comVotacao: false });
      await avancar(3.01);
      const votacao = await (await t.req('diego')).get('/iniciativas?status=EM_VOTACAO&limit=500');
      expect(votacao.body.data.items.map((i: { id: string }) => i.id)).not.toContain(criada.id);
    });
  });

  describe('fluxo 4: reprovação e ressubmissão', () => {
    it('elisa reprova (422 sem justificativa) → ana ressubmete → ciclo 2 com votos zerados e histórico', async () => {
      const criada = await submeter('ana');
      await (await t.req('bruno'))
        .post(`/iniciativas/${criada.id}/comentarios`)
        .send({ texto: 'Ciclo 1: ajustar o espaço.' });
      await avancar(3.01);
      await (await t.req('diego')).put(`/iniciativas/${criada.id}/voto`).send({ valor: 1 });
      await avancar(3.01);

      const semJustificativa = await (await t.req('elisa'))
        .post(`/avaliacao/${criada.id}/decisao`)
        .send({ resultado: 'REPROVADA' });
      expect(semJustificativa.status).toBe(422);
      expect(semJustificativa.headers['content-type']).toContain('application/problem+json');
      expect(semJustificativa.body.errors).toEqual({
        justificativa: ['A justificativa é obrigatória para reprovar.'],
      });
      expect((await detalhe('elisa', criada.id)).status).toBe('EM_ANALISE');

      const reprovada = await (await t.req('elisa'))
        .post(`/avaliacao/${criada.id}/decisao`)
        .send({ resultado: 'REPROVADA', justificativa: 'Coincide com a semana de provas.' });
      expect(reprovada.status).toBe(200);
      expect(reprovada.body.data.decisao).toMatchObject({
        resultado: 'REPROVADA',
        justificativa: 'Coincide com a semana de provas.',
        decisor: { nome: 'Elisa Rocha' },
      });
      expect(reprovada.body.data.permissoes).toMatchObject({ podeRessubmeter: false });
      expect((await detalhe('ana', criada.id)).permissoes.podeRessubmeter).toBe(true);
      expect((await detalhe('ana', criada.id)).ultimaJustificativa).toBe(
        'Coincide com a semana de provas.',
      );

      // outra pessoa não ressubmete (403)
      const intruso = await (await t.req('bruno'))
        .post(`/iniciativas/${criada.id}/ressubmissao`)
        .send(corpo());
      expect(intruso.status).toBe(403);

      // ana ressubmete com ajustes e votação desligada
      const ressubmetida = await (await t.req('ana'))
        .post(`/iniciativas/${criada.id}/ressubmissao`)
        .send(corpo({ titulo: `${criada.titulo} (revisada)`, comVotacao: false }));
      expect(ressubmetida.status).toBe(200);
      expect(ressubmetida.body.data).toMatchObject({
        status: 'EM_ANDAMENTO',
        ciclo: 2,
        comVotacao: false,
        votos: { likes: 0, dislikes: 0 },
        sugestoesCicloAtual: 0,
        meuVoto: 0,
        decisao: null,
        ultimaJustificativa: 'Coincide com a semana de provas.',
      });

      // o comentário do ciclo 1 continua listado, marcado com o ciclo
      const comentarios = await (await t.req('diego')).get(`/iniciativas/${criada.id}/comentarios`);
      expect(comentarios.body.data.items).toMatchObject([
        { ciclo: 1, texto: 'Ciclo 1: ajustar o espaço.' },
      ]);

      // histórico preserva a reprovação com a justificativa
      const historico = await (await t.req('ana')).get(`/iniciativas/${criada.id}/historico`);
      expect(historico.body.data).toContainEqual(
        expect.objectContaining({
          para: 'REPROVADA',
          justificativa: 'Coincide com a semana de provas.',
        }),
      );
      expect(historico.body.data[0]).toMatchObject({
        nota: 'Ressubmetida após reprovação (ciclo 2)',
        ciclo: 2,
      });

      // ressubmeter de novo, ainda em andamento: 409
      const repetida = await (await t.req('ana'))
        .post(`/iniciativas/${criada.id}/ressubmissao`)
        .send(corpo());
      expect(repetida.status).toBe(409);
    });
  });

  describe('fluxo 5: autorização', () => {
    it('diego (aluno) em /avaliacao/fila recebe 403', async () => {
      const resposta = await (await t.req('diego')).get('/avaliacao/fila');
      expect(resposta.status).toBe(403);
      expect(resposta.body.code).toBe('ACCESS_DENIED');
    });

    it('carla decidindo a própria iniciativa recebe 403 (conflito de interesse), e elisa decide', async () => {
      const dela = await submeter('carla', { comVotacao: false });
      await levarParaAnalise(dela.id, false);

      const propria = await (await t.req('carla'))
        .post(`/avaliacao/${dela.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(propria.status).toBe(403);
      expect(propria.body.detail).toBe(
        'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
      );

      const painel = await detalhe('carla', dela.id);
      expect(painel.permissoes).toMatchObject({ podeDecidir: false });
      expect(painel.permissoes.motivoNaoPodeDecidir).toContain('Você é o autor');

      const fila = await (await t.req('carla')).get('/avaliacao/fila?limit=100');
      expect(fila.body.data.items.find((i: { id: string }) => i.id === dela.id).souAutor).toBe(
        true,
      );

      const outra = await (await t.req('elisa'))
        .post(`/avaliacao/${dela.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(outra.status).toBe(200);
    });

    it('o ADMIN decide como o comitê, com a mesma regra de conflito de interesse', async () => {
      const deAna = await submeter('ana', { comVotacao: false });
      const doAdmin = await submeter('admin', { comVotacao: false });
      await avancar(3.01);

      const painel = await detalhe('admin', deAna.id);
      expect(painel.permissoes.podeDecidir).toBe(true);
      const aprovada = await (await t.req('admin'))
        .post(`/avaliacao/${deAna.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(aprovada.status).toBe(200);

      const propria = await (await t.req('admin'))
        .post(`/avaliacao/${doAdmin.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(propria.status).toBe(403);
      expect((await (await t.req('admin')).get('/avaliacao/fila')).status).toBe(200);
    });

    it('bruno editando a iniciativa da ana recebe 403', async () => {
      const dela = await submeter('ana');
      const resposta = await (await t.req('bruno')).patch(`/iniciativas/${dela.id}`).send(corpo());
      expect(resposta.status).toBe(403);
      expect(resposta.body.code).toBe('ACCESS_DENIED');
    });

    it('decidir fora de Em análise recebe 409, e iniciativa inexistente 404', async () => {
      const dela = await submeter('ana');
      const cedo = await (await t.req('carla'))
        .post(`/avaliacao/${dela.id}/decisao`)
        .send({ resultado: 'APROVADA' });
      expect(cedo.status).toBe(409);
      const inexistente = await (await t.req('carla'))
        .post('/avaliacao/00000000-0000-4000-8000-00000000dead/decisao')
        .send({ resultado: 'APROVADA' });
      expect(inexistente.status).toBe(404);
    });
  });

  describe('edição (RN-04)', () => {
    it('o autor edita em Em andamento, inclusive comVotacao, e o histórico registra a edição', async () => {
      const dela = await submeter('ana');
      const resposta = await (await t.req('ana'))
        .patch(`/iniciativas/${dela.id}`)
        .send(corpo({ titulo: 'Título editado', comVotacao: false }));
      expect(resposta.status).toBe(200);
      expect(resposta.body.data).toMatchObject({ titulo: 'Título editado', comVotacao: false });
      const historico = await (await t.req('ana')).get(`/iniciativas/${dela.id}/historico`);
      expect(historico.body.data[0]).toMatchObject({
        de: 'EM_ANDAMENTO',
        para: 'EM_ANDAMENTO',
        nota: 'Iniciativa editada durante o refinamento',
      });
    });

    it('RN-04.4: com o prazo vencido e o job sem rodar, editar recebe 409 e a transição já fica aplicada', async () => {
      const dela = await submeter('ana');
      t.clock.advanceDays(3.5); // sem rodar o job
      const resposta = await (await t.req('ana')).patch(`/iniciativas/${dela.id}`).send(corpo());
      expect(resposta.status).toBe(409);
      expect(resposta.body.detail).toBe(
        'Iniciativas com status "Em votação" não podem ser editadas.',
      );
      expect((await detalhe('ana', dela.id)).status).toBe('EM_VOTACAO');
    });

    it('RN-05.5: comentar com o prazo vencido e o job sem rodar recebe 409', async () => {
      const dela = await submeter('ana');
      t.clock.advanceDays(3.5);
      const resposta = await (await t.req('bruno'))
        .post(`/iniciativas/${dela.id}/comentarios`)
        .send({ texto: 'Tarde demais' });
      expect(resposta.status).toBe(409);
    });
  });

  describe('fluxo 6: erros em Problem Details', () => {
    it('422 com errors por campo, com os nomes dos campos do DTO', async () => {
      const resposta = await (await t.req('ana')).post('/iniciativas').send(
        corpo({
          titulo: '',
          participantes: 0,
          inicio: '2026-12-10',
          fim: '2026-12-01',
          horaFim: null,
        }),
      );
      expect(resposta.status).toBe(422);
      expect(resposta.headers['content-type']).toContain('application/problem+json');
      expect(resposta.body).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
      expect(resposta.body.errors).toEqual({
        titulo: ['Informe o título.'],
        participantes: ['Informe um número maior que zero.'],
        fim: ['A data de término deve ser igual ou posterior à de início.'],
        horaFim: ['Informe a hora de término ou apague a de início.'],
      });
    });

    it('404 e 400 em ids inválidos', async () => {
      const inexistente = await (await t.req('ana')).get(
        '/iniciativas/00000000-0000-4000-8000-00000000dead',
      );
      expect(inexistente.status).toBe(404);
      expect(inexistente.body.code).toBe('NOT_FOUND');
      expect((await (await t.req('ana')).get('/iniciativas/nao-e-uuid')).status).toBe(400);
    });

    it('comentário vazio é 422 e voto inválido é 422', async () => {
      const dela = await submeter('ana');
      const vazio = await (await t.req('bruno'))
        .post(`/iniciativas/${dela.id}/comentarios`)
        .send({ texto: '   ' });
      expect(vazio.status).toBe(422);
      expect(vazio.body.errors.texto).toEqual(['Escreva sua sugestão antes de enviar.']);
      await avancar(3.01);
      const voto = await (await t.req('diego'))
        .put(`/iniciativas/${dela.id}/voto`)
        .send({ valor: 2 });
      expect(voto.status).toBe(422);
    });
  });

  describe('listagens (RNF-05)', () => {
    it('paginam e filtram no servidor, e ordenam por prazo e por relevância', async () => {
      const marca = `busca-${crypto.randomUUID().slice(0, 8)}`;
      const a = await submeter('ana', { titulo: `Zeta ${marca}` });
      await submeter('bruno', { titulo: `Alfa ${marca}`, tipo: 'PESQUISA' });

      const busca = await (await t.req('diego')).get(
        `/iniciativas?q=${marca.toUpperCase()}&ordenar=recentes`,
      );
      expect(busca.body.data.items).toHaveLength(2);
      expect(busca.body.data.meta).toMatchObject({ page: 1, total: 2, totalPages: 1 });

      const tipo = await (await t.req('diego')).get(`/iniciativas?q=${marca}&tipo=PESQUISA`);
      expect(tipo.body.data.items.map((i: { titulo: string }) => i.titulo)).toEqual([
        `Alfa ${marca}`,
      ]);

      const pagina = await (await t.req('diego')).get(`/iniciativas?q=${marca}&limit=1&page=2`);
      expect(pagina.body.data.items).toHaveLength(1);
      expect(pagina.body.data.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });

      const prazo = await (await t.req('diego')).get(
        `/iniciativas?status=EM_ANDAMENTO&ordenar=prazo&q=${marca}`,
      );
      expect(prazo.body.data.items[0].prazoAtual).toBe(prazo.body.data.items[0].fimRefinamento);
      expect(a.id).toBeTruthy();

      const contagens = await (await t.req('carla')).get('/iniciativas/contagens');
      expect(typeof contagens.body.data.emAnalise).toBe('number');

      const invalido = await (await t.req('diego')).get('/iniciativas?status=XPTO');
      expect(invalido.status).toBe(422);
    });
  });
});
