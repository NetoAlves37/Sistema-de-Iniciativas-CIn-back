import { IniciativasFacade } from '../../../src/modules/iniciativas/application/iniciativas.facade';
import { TransicoesJob } from '../../../src/modules/iniciativas/infrastructure/scheduler/transicoes.job';
import { compararRelevancia, wilson } from '../../../src/modules/votacao/domain/relevancia';
import { createTestApp, type TestApp } from '../../support/create-app';

/**
 * Integração de `iniciativas` com Postgres real: concorrência (RN-06.6, RN-10.6), a ordem
 * SQL de relevância contra a função de domínio (RN-08.5) e as consultas de leitura.
 */
describe('Integração: iniciativas', () => {
  let t: TestApp;
  let job: TransicoesJob;
  let facade: IniciativasFacade;

  beforeAll(async () => {
    t = await createTestApp();
    job = t.app.get(TransicoesJob);
    facade = t.app.get(IniciativasFacade);
  });

  afterAll(async () => {
    await t.close();
  });

  const corpo = (sobrescritas: Record<string, unknown> = {}) => ({
    tipo: 'EVENTO',
    titulo: `Iniciativa ${crypto.randomUUID().slice(0, 8)}`,
    resumo: 'Resumo.',
    detalhe: 'Detalhe.',
    inicio: '2026-12-01',
    fim: '2026-12-03',
    periodicidade: 'DIARIA',
    espaco: 'Auditório',
    organizadores: 'Org',
    participantes: 10,
    comVotacao: true,
    ...sobrescritas,
  });

  async function submeter(autor: 'ana' | 'carla', sobrescritas: Record<string, unknown> = {}) {
    const resposta = await (await t.req(autor)).post('/iniciativas').send(corpo(sobrescritas));
    expect(resposta.status).toBe(201);
    return resposta.body.data as { id: string; titulo: string };
  }

  const contarHistorico = (iniciativaId: string, para: string) =>
    t.prisma.transicaoHistorico.count({ where: { iniciativaId, para: { code: para } } });

  describe('RN-06.6: transições concorrentes', () => {
    it('várias execuções simultâneas do job geram uma única transição (sem histórico duplicado)', async () => {
      const criada = await submeter('ana');
      t.clock.advanceDays(3.01);

      await Promise.all([job.executarAgora(), job.executarAgora(), job.executarAgora()]);

      expect(await contarHistorico(criada.id, 'EM_VOTACAO')).toBe(1);
      const linha = await t.prisma.iniciativa.findUniqueOrThrow({
        where: { id: criada.id },
        include: { status: true },
      });
      expect(linha.status.code).toBe('EM_VOTACAO');
      expect(linha.version).toBe(1);
    });

    it('o job e uma leitura de detalhe ao mesmo tempo também não duplicam', async () => {
      const criada = await submeter('ana', { comVotacao: false });
      t.clock.advanceDays(3.01);

      await Promise.all([
        job.executarAgora(),
        (await t.req('ana')).get(`/iniciativas/${criada.id}`),
        (await t.req('diego')).get(`/iniciativas/${criada.id}`),
      ]);

      expect(await contarHistorico(criada.id, 'EM_ANALISE')).toBe(1);
    });
  });

  describe('RN-10.6: decisões concorrentes', () => {
    it('duas decisões simultâneas resultam em uma 200 e uma 409', async () => {
      const criada = await submeter('ana', { comVotacao: false });
      t.clock.advanceDays(3.01);
      await job.executarAgora();

      const [aprovar, reprovar] = await Promise.all([
        (await t.req('carla'))
          .post(`/avaliacao/${criada.id}/decisao`)
          .send({ resultado: 'APROVADA' }),
        (await t.req('elisa'))
          .post(`/avaliacao/${criada.id}/decisao`)
          .send({ resultado: 'REPROVADA', justificativa: 'Sem espaço.' }),
      ]);

      expect([aprovar.status, reprovar.status].sort()).toEqual([200, 409]);
      const perdedora = aprovar.status === 409 ? aprovar : reprovar;
      expect(perdedora.body.detail).toBe('Esta iniciativa já foi decidida.');
      expect(
        (await contarHistorico(criada.id, 'APROVADA')) +
          (await contarHistorico(criada.id, 'REPROVADA')),
      ).toBe(1);
    });
  });

  describe('RN-08.5: a ordem do SQL bate com a função de domínio', () => {
    async function inserirEmVotacao(
      titulo: string,
      criadaEm: Date,
      likes: number,
      dislikes: number,
      comPlacar = true,
    ) {
      const iniciativa = await t.prisma.iniciativa.create({
        data: {
          autorId: 'autor-ordenacao',
          titulo,
          resumo: 'r',
          detalhe: 'd',
          inicio: new Date('2026-12-01'),
          fim: new Date('2026-12-02'),
          espaco: 'e',
          organizadores: 'o',
          participantes: 5,
          comVotacao: true,
          ciclo: 1,
          criadaEm,
          fimRefinamento: new Date('2099-01-01'),
          fimVotacao: new Date('2099-02-01'),
          tipo: { connect: { code: 'EVENTO' } },
          periodicidade: { connect: { code: 'DIARIA' } },
          status: { connect: { code: 'EM_VOTACAO' } },
        },
      });
      if (comPlacar) {
        await t.prisma.placar.create({
          data: {
            iniciativaId: iniciativa.id,
            ciclo: 1,
            likes,
            dislikes,
            relevancia: wilson(likes, likes + dislikes),
          },
        });
      }
      return {
        id: iniciativa.id,
        likes,
        dislikes,
        criadaEm,
        relevancia: wilson(likes, likes + dislikes),
      };
    }

    it('ordena por relevância, depois votos totais, criação mais antiga e id', async () => {
      const marca = crypto.randomUUID().slice(0, 8);
      const base = new Date('2026-10-01T00:00:00Z').getTime();
      const itens = [
        await inserirEmVotacao(`${marca} A`, new Date(base + 1000), 34, 3),
        await inserirEmVotacao(`${marca} B`, new Date(base + 2000), 9, 11),
        // empate exato de relevância e de total de votos: desempata pela criação mais antiga
        await inserirEmVotacao(`${marca} C`, new Date(base + 4000), 6, 0),
        await inserirEmVotacao(`${marca} D`, new Date(base + 3000), 6, 0),
        await inserirEmVotacao(`${marca} E`, new Date(base + 5000), 3, 0),
        await inserirEmVotacao(`${marca} F`, new Date(base + 6000), 0, 4),
        // sem linha de placar (sem votos): relevância 0 e zero votos
        await inserirEmVotacao(`${marca} G`, new Date(base + 7000), 0, 0, false),
        await inserirEmVotacao(`${marca} H`, new Date(base + 7000), 0, 0, false),
      ];

      const esperado = [...itens].sort(compararRelevancia).map((i) => i.id);

      const resposta = await (await t.req('diego')).get(
        `/iniciativas?status=EM_VOTACAO&ordenar=relevancia&q=${marca}&limit=100`,
      );
      expect(resposta.status).toBe(200);
      const obtido = resposta.body.data.items.map((i: { id: string }) => i.id);
      expect(obtido).toEqual(esperado);

      // a relevância exibida é a do placar (tolerância de 1 ulp do double)
      for (const item of resposta.body.data.items as Array<{
        id: string;
        votos: { relevancia: number };
      }>) {
        const origem = itens.find((i) => i.id === item.id);
        expect(item.votos.relevancia).toBeCloseTo(origem?.relevancia ?? 0, 12);
      }
    });

    it('a paginação respeita a ordem (a página 2 continua a 1)', async () => {
      const marca = crypto.randomUUID().slice(0, 8);
      const base = new Date('2026-10-02T00:00:00Z').getTime();
      const itens = [];
      for (let i = 0; i < 5; i++) {
        itens.push(await inserirEmVotacao(`${marca} ${i}`, new Date(base + i * 1000), 10 - i, i));
      }
      const esperado = [...itens].sort(compararRelevancia).map((i) => i.id);

      const p1 = await (await t.req('diego')).get(
        `/iniciativas?q=${marca}&ordenar=relevancia&limit=2&page=1`,
      );
      const p2 = await (await t.req('diego')).get(
        `/iniciativas?q=${marca}&ordenar=relevancia&limit=2&page=2`,
      );
      const p3 = await (await t.req('diego')).get(
        `/iniciativas?q=${marca}&ordenar=relevancia&limit=2&page=3`,
      );
      const ids = [p1, p2, p3].flatMap((r) => r.body.data.items.map((i: { id: string }) => i.id));
      expect(ids).toEqual(esperado);
      expect(p1.body.data.meta).toMatchObject({ total: 5, totalPages: 3 });
    });
  });

  describe('persistência', () => {
    it('grava e relê todos os campos, inclusive os opcionais nulos e o horário', async () => {
      const completa = await (await t.req('ana')).post('/iniciativas').send(
        corpo({
          horaInicio: '08:30',
          horaFim: '12:00',
          membros: 'Diego Alves',
          participantes: 99,
        }),
      );
      expect(completa.body.data).toMatchObject({
        horaInicio: '08:30',
        horaFim: '12:00',
        membros: 'Diego Alves',
        participantes: 99,
        inicio: '2026-12-01',
        fim: '2026-12-03',
        periodicidade: 'DIARIA',
        tipo: 'EVENTO',
      });

      const simples = await (await t.req('ana')).post('/iniciativas').send(corpo());
      expect(simples.body.data).toMatchObject({ horaInicio: null, horaFim: null, membros: null });
    });

    it('o banco recusa dados que violam as regras (CHECK), mesmo fora da aplicação', async () => {
      const base = {
        autorId: 'x',
        titulo: 't',
        resumo: 'r',
        detalhe: 'd',
        espaco: 'e',
        organizadores: 'o',
        tipo: { connect: { code: 'EVENTO' } },
        periodicidade: { connect: { code: 'DIARIA' } },
        status: { connect: { code: 'EM_ANDAMENTO' } },
      };
      await expect(
        t.prisma.iniciativa.create({
          data: {
            ...base,
            inicio: new Date('2026-12-10'),
            fim: new Date('2026-12-01'),
            participantes: 5,
          },
        }),
      ).rejects.toThrow();
      await expect(
        t.prisma.iniciativa.create({
          data: {
            ...base,
            inicio: new Date('2026-12-01'),
            fim: new Date('2026-12-01'),
            participantes: 0,
          },
        }),
      ).rejects.toThrow();
      await expect(
        t.prisma.iniciativa.create({
          data: {
            ...base,
            inicio: new Date('2026-12-01'),
            fim: new Date('2026-12-01'),
            participantes: 5,
            horaInicio: '09:00',
            horaFim: null,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('consultas de leitura', () => {
    it('minhas devolve a contagem por status de todas as iniciativas do autor, mesmo filtrando um status', async () => {
      const criada = await submeter('carla', { comVotacao: false });
      const resposta = await (await t.req('carla')).get(
        '/iniciativas/minhas?status=EM_ANDAMENTO&limit=500',
      );
      expect(resposta.body.data.items.map((i: { id: string }) => i.id)).toContain(criada.id);
      expect(
        resposta.body.data.items.every(
          (i: { autor: { nome: string } }) => i.autor.nome === 'Carla Menezes',
        ),
      ).toBe(true);
      expect(resposta.body.data.meta.contagemPorStatus.EM_ANDAMENTO).toBeGreaterThanOrEqual(1);
    });

    it('aprovadasParaCalendario filtra por período (fim exclusivo), tipo e autor', async () => {
      const marca = crypto.randomUUID().slice(0, 8);
      const aprovar = async (
        titulo: string,
        inicio: string,
        fim: string,
        tipo: string,
        autorId: string,
      ) =>
        t.prisma.iniciativa.create({
          data: {
            autorId,
            titulo: `${marca} ${titulo}`,
            resumo: 'r',
            detalhe: 'd',
            inicio: new Date(inicio),
            fim: new Date(fim),
            espaco: 'e',
            organizadores: 'o',
            participantes: 5,
            tipo: { connect: { code: tipo } },
            periodicidade: { connect: { code: 'DIARIA' } },
            status: { connect: { code: 'APROVADA' } },
          },
        });
      await aprovar('dentro', '2027-03-10', '2027-03-12', 'EVENTO', 'u-cal-1');
      await aprovar('antes', '2027-02-01', '2027-02-28', 'EVENTO', 'u-cal-1');
      await aprovar('comeca-no-fim', '2027-03-20', '2027-03-22', 'EVENTO', 'u-cal-1'); // `ate` exclusivo
      await aprovar('cruza', '2027-03-18', '2027-03-25', 'PESQUISA', 'u-cal-2');

      const todas = await facade.aprovadasParaCalendario({ de: '2027-03-01', ate: '2027-03-20' });
      const titulos = todas
        .map((a) => a.titulo)
        .filter((x) => x.startsWith(marca))
        .sort();
      expect(titulos).toEqual([`${marca} cruza`, `${marca} dentro`]);

      const soPesquisa = await facade.aprovadasParaCalendario({
        de: '2027-03-01',
        ate: '2027-03-20',
        tipos: ['PESQUISA'],
      });
      expect(soPesquisa.filter((a) => a.titulo.startsWith(marca)).map((a) => a.titulo)).toEqual([
        `${marca} cruza`,
      ]);

      const doAutor = await facade.aprovadasParaCalendario({
        de: '2027-03-01',
        ate: '2027-03-20',
        autorId: 'u-cal-1',
      });
      expect(doAutor.filter((a) => a.titulo.startsWith(marca)).map((a) => a.titulo)).toEqual([
        `${marca} dentro`,
      ]);
    });

    it('só o que está em andamento ou em votação com prazo vencido entra no job', async () => {
      const marca = crypto.randomUUID().slice(0, 8);
      const criar = (titulo: string, status: string, extras: Record<string, unknown>) =>
        t.prisma.iniciativa.create({
          data: {
            autorId: 'x',
            titulo: `${marca} ${titulo}`,
            resumo: 'r',
            detalhe: 'd',
            inicio: new Date('2026-12-01'),
            fim: new Date('2026-12-01'),
            espaco: 'e',
            organizadores: 'o',
            participantes: 5,
            tipo: { connect: { code: 'EVENTO' } },
            periodicidade: { connect: { code: 'DIARIA' } },
            status: { connect: { code: status } },
            ...extras,
          },
        });
      const passado = new Date(t.clock.now().getTime() - 1000);
      const futuro = new Date(t.clock.now().getTime() + 86_400_000);
      const venceuRef = await criar('venceu-refinamento', 'EM_ANDAMENTO', {
        fimRefinamento: passado,
      });
      const venceuVot = await criar('venceu-votacao', 'EM_VOTACAO', { fimVotacao: passado });
      const aberta = await criar('aberta', 'EM_ANDAMENTO', { fimRefinamento: futuro });
      const analise = await criar('em-analise', 'EM_ANALISE', {});

      await job.executarAgora();

      const status = async (id: string) =>
        (await t.prisma.iniciativa.findUniqueOrThrow({ where: { id }, include: { status: true } }))
          .status.code;
      expect(await status(venceuRef.id)).toBe('EM_VOTACAO'); // sem votação marcada = padrão true
      expect(await status(venceuVot.id)).toBe('EM_ANALISE');
      expect(await status(aberta.id)).toBe('EM_ANDAMENTO');
      expect(await status(analise.id)).toBe('EM_ANALISE');
    });
  });
});
