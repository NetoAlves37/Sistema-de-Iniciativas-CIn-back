import { describe, expect, it, vi } from 'vitest';
import type { AprovadaParaCalendario } from '@/modules/divulgacao/application/dto/divulgacao.dto';
import type {
  FiltroCalendario,
  IniciativasPort,
} from '@/modules/divulgacao/application/ports/iniciativas.port';
import { ListarOcorrencias } from '@/modules/divulgacao/application/queries/listar-ocorrencias';
import { googleAgendaUrl } from '@/modules/divulgacao/domain/google-agenda-url';
import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { ValidacaoError } from '@/shared/domain/domain-error';
import { montarPainel } from './helpers/painel-em-memoria';

/* ===========================================================================
 * US04 - CALENDÁRIO E RECORRÊNCIA  |  Lacunas L2 e L4
 *
 * ESCOPO: `ListarOcorrencias` (divulgacao) com um `IniciativasPort` falso, e `detalhe` de
 * `ConsultasIniciativas` para o link do Google Agenda.
 *
 * NÃO TESTÁVEL EM NÍVEL UNITÁRIO (regra 5):
 *  - "Não aprovadas (EM_ANDAMENTO, EM_VOTACAO, EM_ANALISE, REPROVADA) não aparecem":
 *    a exclusão é feita pelo SQL `WHERE s.code = 'APROVADA'` em
 *    iniciativa-listagem.query.ts (aprovadasParaCalendario). `ListarOcorrencias` confia na porta
 *    e não olha status (o DTO AprovadaParaCalendario nem tem esse campo). Um fake que filtrasse
 *    por status só testaria o próprio fake. Precisa de teste de integração com banco.
 *  - Rota GET /divulgacao/ocorrencias (guard JWT, parsing de query pelo Zod): exige Nest/HTTP.
 * ========================================================================= */

const JANELA = { de: '2026-12-01', ate: '2027-01-31' }; // 61 dias

const aprovada = (sobrescritas: Partial<AprovadaParaCalendario> = {}): AprovadaParaCalendario => ({
  id: 'a1',
  titulo: 'Hackathon de Acessibilidade Digital',
  tipo: 'EVENTO',
  resumo: 'Maratona de 24h para criar soluções acessíveis.',
  inicio: '2026-12-10',
  fim: '2026-12-10',
  horaInicio: '09:00',
  horaFim: '18:00',
  periodicidade: 'EVENTO_UNICO',
  espaco: 'Auditório do CIn',
  organizadores: 'Bruno Lima, Diretório Acadêmico',
  autorId: 'ana',
  ...sobrescritas,
});

function montarCalendario(aprovadas: AprovadaParaCalendario[] = []) {
  const aprovadasParaCalendario = vi.fn(async (_filtro: FiltroCalendario) => aprovadas);
  const iniciativas: IniciativasPort = {
    listarAprovadas: vi.fn(async () => ({ items: [], total: 0 })),
    aprovadasParaCalendario,
  };
  return { listar: new ListarOcorrencias(iniciativas), aprovadasParaCalendario };
}

const consultar = (ctx: ReturnType<typeof montarCalendario>, de: string, ate: string) =>
  ctx.listar.executar({ de, ate, usuarioId: 'ana' });

/* ------------------------------------------------------------------------- *
 * L2 - aprovadas e data no intervalo
 * ------------------------------------------------------------------------- */
describe('US04 - Calendário: iniciativas aprovadas no intervalo (L2)', () => {
  it('US04 aprovada aparece no calendário | Partição de Equivalência (aprovada dentro do intervalo) | uma ocorrência com os dados da iniciativa', async () => {
    // Requisito: US04 - "Aprovadas aparecem no calendário" (L2)
    // Técnica: Partição de Equivalência (classe: aprovada com data dentro do intervalo)
    // Esperado: 1 ocorrência da iniciativa a1, com título, tipo, espaço e horário; a porta é
    //           consultada com o intervalo pedido
    const ctx = montarCalendario([aprovada()]);

    const ocorrencias = await consultar(ctx, JANELA.de, JANELA.ate);

    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0]).toMatchObject({
      iniciativaId: 'a1',
      titulo: 'Hackathon de Acessibilidade Digital',
      tipo: 'EVENTO',
      espaco: 'Auditório do CIn',
      inicio: '2026-12-10T09:00',
      fim: '2026-12-10T18:00',
      diaInteiro: false,
    });
    expect(ctx.aprovadasParaCalendario).toHaveBeenCalledWith({
      de: JANELA.de,
      ate: JANELA.ate,
      tipos: undefined,
      autorId: undefined,
    });
  });

  it('US04 aprovada sem horário aparece no dia correspondente | Partição de Equivalência (evento de dia inteiro) | ocorrência no dia de início, marcada como dia inteiro', async () => {
    // Requisito: US04 - "Iniciativa aparece na data correspondente, dentro do intervalo consultado" (L2)
    // Técnica: Partição de Equivalência (classe: evento de dia inteiro, sem horário)
    // Esperado: 1 ocorrência com inicio = '2026-12-10' e diaInteiro = true
    const ctx = montarCalendario([aprovada({ horaInicio: null, horaFim: null })]);

    const ocorrencias = await consultar(ctx, JANELA.de, JANELA.ate);

    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0]).toMatchObject({ iniciativaId: 'a1', inicio: '2026-12-10', diaInteiro: true });
  });

  it.each([
    ['antes do intervalo', '2026-10-01', '2026-11-01'],
    ['depois do intervalo', '2027-01-01', '2027-02-01'],
  ])(
    'US04 iniciativa %s consultado | Partição de Equivalência (classe: data fora do intervalo) | não aparece',
    async (_descricao, de, ate) => {
      // Requisito: US04 - a iniciativa só aparece dentro do intervalo consultado (L2)
      // Técnica: Partição de Equivalência (data da iniciativa anterior / posterior ao intervalo)
      // Esperado: nenhuma ocorrência (lista vazia), mesmo que a porta devolva a iniciativa
      const ctx = montarCalendario([aprovada()]); // 2026-12-10

      const ocorrencias = await consultar(ctx, de, ate);

      expect(ocorrencias).toEqual([]);
    },
  );
});

/* ------------------------------------------------------------------------- *
 * L2 - recorrência
 * Datas esperadas calculadas à mão a partir da periodicidade (passo de 1, 7, 14 dias ou
 * mesmo dia do mês), sempre dentro do período [inicio, fim] da iniciativa.
 * ------------------------------------------------------------------------- */
describe('US04 - Calendário: recorrência (L2)', () => {
  it.each([
    [
      'DIARIA',
      { inicio: '2026-12-01', fim: '2026-12-05' },
      ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'],
    ],
    [
      'SEMANAL',
      { inicio: '2026-12-02', fim: '2026-12-30' },
      ['2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23', '2026-12-30'],
    ],
    [
      'QUINZENAL',
      { inicio: '2026-12-02', fim: '2026-12-30' },
      ['2026-12-02', '2026-12-16', '2026-12-30'],
    ],
    [
      'MENSAL',
      { inicio: '2026-12-15', fim: '2027-02-15' },
      ['2026-12-15', '2027-01-15'], // 2027-02-15 fica fora do intervalo consultado (até 2027-01-31)
    ],
  ])(
    'US04 recorrência %s | Partição de Equivalência (uma classe por periodicidade) | ocorrências conforme a periodicidade',
    async (periodicidade, periodo, datasEsperadas) => {
      // Requisito: US04 - "Recorrência DIARIA, SEMANAL, QUINZENAL ou MENSAL gera ocorrências
      //            conforme a periodicidade" (L2)
      // Técnica: Partição de Equivalência (cada periodicidade recorrente)
      // Esperado: uma ocorrência (dia inteiro) em cada data da lista, em ordem cronológica, e
      //           nenhuma fora do período da iniciativa
      const ctx = montarCalendario([
        aprovada({
          ...periodo,
          horaInicio: null,
          horaFim: null,
          periodicidade: periodicidade as AprovadaParaCalendario['periodicidade'],
        }),
      ]);

      const ocorrencias = await consultar(ctx, JANELA.de, JANELA.ate);

      expect(ocorrencias.map((o) => o.inicio)).toEqual(datasEsperadas);
      expect(ocorrencias.every((o) => o.iniciativaId === 'a1' && o.periodicidade === periodicidade)).toBe(true);
      expect(ocorrencias.every((o) => o.diaInteiro)).toBe(true);
    },
  );

  it('US04 recorrência DIARIA com horário | Partição de Equivalência (recorrente com horário) | cada dia traz o horário de início e fim', async () => {
    // Requisito: US04 - recorrência gera ocorrências conforme a periodicidade, com horário (L2)
    // Técnica: Partição de Equivalência (periodicidade DIARIA com horaInicio/horaFim)
    // Esperado: 3 ocorrências (01, 02 e 03/12), de 09:00 a 10:00, diaInteiro = false
    const ctx = montarCalendario([
      aprovada({
        inicio: '2026-12-01',
        fim: '2026-12-03',
        horaInicio: '09:00',
        horaFim: '10:00',
        periodicidade: 'DIARIA',
      }),
    ]);

    const ocorrencias = await consultar(ctx, JANELA.de, JANELA.ate);

    expect(ocorrencias.map((o) => [o.inicio, o.fim, o.diaInteiro])).toEqual([
      ['2026-12-01T09:00', '2026-12-01T10:00', false],
      ['2026-12-02T09:00', '2026-12-02T10:00', false],
      ['2026-12-03T09:00', '2026-12-03T10:00', false],
    ]);
  });
});

/* ------------------------------------------------------------------------- *
 * L2 - intervalo inválido
 * ------------------------------------------------------------------------- */
describe('US04 - Calendário: intervalo inválido (L2)', () => {
  it.each([
    ['de com mês 13', '2026-13-40', '2026-12-31', ['de']],
    ['de com dia inexistente (30/02)', '2026-02-30', '2026-03-15', ['de']],
    ['de em formato dd/mm/aaaa', '01/12/2026', '2026-12-31', ['de']],
    ['ate com dia 32', '2026-12-01', '2026-12-32', ['ate']],
    ['ate não é data', '2026-12-01', 'abc', ['ate']],
    ['de e ate vazios', '', '', ['ate', 'de']],
  ])(
    'US04 data inválida (%s) | Partição de Equivalência (classe inválida: data) | ValidacaoError no(s) campo(s) inválido(s)',
    async (_descricao, de, ate, camposEsperados) => {
      // Requisito: US04 - "Intervalo inválido (data inválida ...) -> erro de validação" (L2)
      // Técnica: Partição de Equivalência (formato inválido, data inexistente, vazio)
      // Esperado: ValidacaoError (tipo 'validacao') indicando exatamente os campos inválidos, e a
      //           porta de iniciativas nem é consultada
      const ctx = montarCalendario([aprovada()]);

      const erro = await consultar(ctx, de, ate).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ValidacaoError);
      expect((erro as ValidacaoError).tipo).toBe('validacao');
      expect(Object.keys((erro as ValidacaoError).campos).sort()).toEqual(camposEsperados);
      expect(ctx.aprovadasParaCalendario).not.toHaveBeenCalled();
    },
  );

  it('US04 intervalo de um ano | Partição de Equivalência (classe inválida: intervalo muito maior que 62 dias) | ValidacaoError no campo ate', async () => {
    // Requisito: US04 - "Intervalo inválido (... superior a 62 dias) -> erro de validação" (L2)
    // Técnica: Partição de Equivalência (intervalo bem acima do limite)
    // Esperado: ValidacaoError com mensagem no campo `ate` citando o máximo de 62 dias; porta não consultada
    const ctx = montarCalendario([aprovada()]);

    const erro = await consultar(ctx, '2026-01-01', '2027-01-01').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(Object.keys((erro as ValidacaoError).campos)).toEqual(['ate']);
    expect((erro as ValidacaoError).campos.ate).toContain('62');
    expect(ctx.aprovadasParaCalendario).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------- *
 * L4 - valores-limite do intervalo (62 válido, 63 inválido)
 * Datas verificadas por calendário: de + 62 dias e de + 63 dias.
 * ------------------------------------------------------------------------- */
describe('US04 - Calendário: valores-limite do intervalo (L4)', () => {
  it.each([
    ['atravessa dezembro/janeiro', '2026-12-01', '2027-02-01', '2027-02-02'],
    ['atravessa fevereiro bissexto', '2028-01-15', '2028-03-17', '2028-03-18'],
    ['atravessa março/abril/maio', '2026-03-01', '2026-05-02', '2026-05-03'],
  ])(
    'US04 intervalo de 62 dias (%s) | Valor-Limite (máximo válido) | aceito e consultado na porta',
    async (_descricao, de, ate62) => {
      // Requisito: US04 - intervalo de no máximo 62 dias é válido (L4)
      // Técnica: Valor-Limite (máximo = 62 dias), com início em meses de tamanhos diferentes
      // Esperado: resolve (lista vazia, pois a porta não devolve nada) e a porta recebe de/ate pedidos
      const ctx = montarCalendario([]);

      await expect(consultar(ctx, de, ate62)).resolves.toEqual([]);

      expect(ctx.aprovadasParaCalendario).toHaveBeenCalledWith({
        de,
        ate: ate62,
        tipos: undefined,
        autorId: undefined,
      });
    },
  );

  it.each([
    ['atravessa dezembro/janeiro', '2026-12-01', '2027-02-02'],
    ['atravessa fevereiro bissexto', '2028-01-15', '2028-03-18'],
    ['atravessa março/abril/maio', '2026-03-01', '2026-05-03'],
  ])(
    'US04 intervalo de 63 dias (%s) | Valor-Limite (máximo + 1) | ValidacaoError no campo ate',
    async (_descricao, de, ate63) => {
      // Requisito: US04 - intervalo superior a 62 dias é inválido (L4)
      // Técnica: Valor-Limite (máximo + 1 = 63 dias)
      // Esperado: ValidacaoError em `ate` citando 62 dias; porta não consultada
      const ctx = montarCalendario([aprovada()]);

      const erro = await consultar(ctx, de, ate63).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ValidacaoError);
      expect(Object.keys((erro as ValidacaoError).campos)).toEqual(['ate']);
      expect((erro as ValidacaoError).campos.ate).toContain('62');
      expect(ctx.aprovadasParaCalendario).not.toHaveBeenCalled();
    },
  );
});

/* ------------------------------------------------------------------------- *
 * L2 - link do Google Agenda
 * ------------------------------------------------------------------------- */
describe('US04 - Calendário: link para o Google Agenda (L2)', () => {
  it('US04 ocorrência traz link do Google Agenda | Partição de Equivalência (aprovada com horário) | link aponta para o evento da iniciativa', async () => {
    // Requisito: US04 - "Iniciativa aprovada tem link para o Google Agenda" (L2)
    // Técnica: Partição de Equivalência (aprovada de evento único com horário)
    // Esperado: googleAgendaUrl é uma URL do Google Calendar (action=TEMPLATE) com o título da
    //           iniciativa e as datas/horas no formato do Google (YYYYMMDDTHHmmss/YYYYMMDDTHHmmss)
    const ctx = montarCalendario([aprovada()]);

    const [ocorrencia] = await consultar(ctx, JANELA.de, JANELA.ate);

    const link = new URL(ocorrencia.googleAgendaUrl);
    expect(link.origin).toBe('https://calendar.google.com');
    expect(link.pathname).toBe('/calendar/render');
    expect(link.searchParams.get('action')).toBe('TEMPLATE');
    expect(link.searchParams.get('text')).toBe('Hackathon de Acessibilidade Digital');
    expect(link.searchParams.get('dates')).toBe('20261210T090000/20261210T180000');
    expect(link.searchParams.get('location')).toContain('Auditório do CIn');
  });

  it('US04 todas as ocorrências de uma recorrente têm o link | Partição de Equivalência (recorrente) | link presente em cada ocorrência', async () => {
    // Requisito: US04 - iniciativa aprovada tem link para o Google Agenda (L2)
    // Técnica: Partição de Equivalência (periodicidade SEMANAL, várias ocorrências)
    // Esperado: 3 ocorrências e todas com link do Google Agenda para o mesmo título
    const ctx = montarCalendario([
      aprovada({
        inicio: '2026-12-02',
        fim: '2026-12-16',
        horaInicio: null,
        horaFim: null,
        periodicidade: 'SEMANAL',
      }),
    ]);

    const ocorrencias = await consultar(ctx, JANELA.de, JANELA.ate);

    expect(ocorrencias).toHaveLength(3);
    for (const ocorrencia of ocorrencias) {
      const link = new URL(ocorrencia.googleAgendaUrl);
      expect(link.origin).toBe('https://calendar.google.com');
      expect(link.searchParams.get('text')).toBe('Hackathon de Acessibilidade Digital');
    }
  });

  it('US04 detalhe da iniciativa aprovada traz link do Google Agenda | Partição de Equivalência (status APROVADA) | googleAgendaUrl preenchido', async () => {
    // Requisito: US04 - "Iniciativa aprovada tem link para o Google Agenda" (L2), no detalhe
    // Técnica: Partição de Equivalência (status = APROVADA)
    // Esperado: googleAgendaUrl é URL do Google Calendar com o título da iniciativa. A porta de
    //           `iniciativas` é ligada à função real de `divulgacao` (é a mesma ligação do módulo).
    const ctx = montarPainel({
      googleAgenda: {
        url: (dados) =>
          googleAgendaUrl({
            ...dados,
            periodicidade: dados.periodicidade as AprovadaParaCalendario['periodicidade'],
          }),
      },
    });
    ctx.leitura.semear(
      umaIniciativa().comId('i1').doAutor('ana').aprovada('carla').construir(),
    );

    const detalhe = await ctx.consultas.detalhe('i1', { id: 'bruno', nome: 'Bruno Lima', ehComite: false });

    expect(detalhe.status).toBe('APROVADA');
    expect(detalhe.googleAgendaUrl).not.toBeNull();
    const link = new URL(detalhe.googleAgendaUrl as string);
    expect(link.origin).toBe('https://calendar.google.com');
    expect(link.searchParams.get('action')).toBe('TEMPLATE');
    expect(link.searchParams.get('text')).toBe('Hackathon de Acessibilidade Digital');
    expect(link.searchParams.get('dates')?.startsWith('20261210')).toBe(true);
  });
});
