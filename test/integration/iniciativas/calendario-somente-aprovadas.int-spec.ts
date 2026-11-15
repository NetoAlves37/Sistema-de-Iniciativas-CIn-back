import { IniciativasFacade } from '../../../src/modules/iniciativas/application/iniciativas.facade';
import { createTestApp, type TestApp } from '../../support/create-app';

/**
 * Integração com Postgres real (lacuna L14 da v2).
 *
 * Requisito: US04 - Iniciativas não aprovadas não aparecem no calendário.
 * O filtro está no SQL (`WHERE s.code = 'APROVADA'`), por isso só um teste com banco o verifica.
 * Cada execução usa uma marca única no título, então os dados de outros testes não interferem.
 */
describe('Integração (v2): calendário só mostra iniciativas aprovadas', () => {
  let t: TestApp;
  let facade: IniciativasFacade;

  beforeAll(async () => {
    t = await createTestApp();
    facade = t.app.get(IniciativasFacade);
  });

  afterAll(async () => {
    await t.close();
  });

  it('US04 EM_ANDAMENTO, EM_VOTACAO, EM_ANALISE e REPROVADA não aparecem; a APROVADA aparece', async () => {
    // Requisito: US04 - Iniciativas não aprovadas não aparecem no calendário
    // Técnica: Partição de Equivalência (cada status diferente de APROVADA, mais a APROVADA de controle)
    // Esperado: das 5 iniciativas do mesmo período, só a APROVADA volta
    const marca = crypto.randomUUID().slice(0, 8);
    const futuro = new Date('2099-01-01');
    const criar = (status: string, extras: Record<string, unknown> = {}) =>
      t.prisma.iniciativa.create({
        data: {
          autorId: 'u-cal-status',
          titulo: `${marca} ${status}`,
          resumo: 'r',
          detalhe: 'd',
          inicio: new Date('2027-05-10'),
          fim: new Date('2027-05-12'),
          espaco: 'e',
          organizadores: 'o',
          participantes: 5,
          tipo: { connect: { code: 'EVENTO' } },
          periodicidade: { connect: { code: 'DIARIA' } },
          status: { connect: { code: status } },
          ...extras,
        },
      });

    await criar('EM_ANDAMENTO', { fimRefinamento: futuro });
    await criar('EM_VOTACAO', { fimRefinamento: futuro, fimVotacao: futuro });
    await criar('EM_ANALISE');
    await criar('REPROVADA');
    await criar('APROVADA');

    const resultado = await facade.aprovadasParaCalendario({ de: '2027-05-01', ate: '2027-06-01' });

    const titulos = resultado.map((a) => a.titulo).filter((x) => x.startsWith(marca));
    expect(titulos).toEqual([`${marca} APROVADA`]);
  });
});
