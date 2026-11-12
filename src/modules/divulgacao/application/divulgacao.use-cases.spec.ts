import { ValidacaoError } from '@/shared/domain/domain-error';
import { DivulgacaoFacade } from './divulgacao.facade';
import type { AprovadaParaCalendario, ResumoIniciativa } from './dto/divulgacao.dto';
import type { FiltroAprovadas, FiltroCalendario, IniciativasPort } from './ports/iniciativas.port';
import { ListarAprovadas } from './queries/listar-aprovadas';
import { ListarOcorrencias } from './queries/listar-ocorrencias';

class IniciativasEmMemoria implements IniciativasPort {
  aprovadas: ResumoIniciativa[] = [];
  calendario: AprovadaParaCalendario[] = [];
  filtrosAprovadas: FiltroAprovadas[] = [];
  filtrosCalendario: FiltroCalendario[] = [];

  async listarAprovadas(filtro: FiltroAprovadas) {
    this.filtrosAprovadas.push(filtro);
    return { items: this.aprovadas, total: this.aprovadas.length };
  }

  async aprovadasParaCalendario(filtro: FiltroCalendario) {
    this.filtrosCalendario.push(filtro);
    return this.calendario;
  }
}

const aprovada = (parcial: Partial<AprovadaParaCalendario>): AprovadaParaCalendario => ({
  id: 'i-1',
  titulo: 'Oficina de Python',
  tipo: 'EXTENSAO',
  resumo: 'Resumo',
  inicio: '2026-11-03',
  fim: '2026-11-20',
  horaInicio: null,
  horaFim: null,
  periodicidade: 'DIARIA',
  espaco: 'Sala E122',
  organizadores: 'Ana Souza',
  autorId: 'ana',
  ...parcial,
});

describe('ListarAprovadas (RN-12.5)', () => {
  it('delega a busca e o filtro por tipo, com paginação', async () => {
    const iniciativas = new IniciativasEmMemoria();
    await new ListarAprovadas(iniciativas).executar({
      q: '  python ',
      tipo: 'PESQUISA',
      page: 2,
      limit: 5,
    });
    expect(iniciativas.filtrosAprovadas).toEqual([
      { q: 'python', tipo: 'PESQUISA', page: 2, limit: 5 },
    ]);
  });

  it('busca vazia vira ausência de filtro', async () => {
    const iniciativas = new IniciativasEmMemoria();
    await new ListarAprovadas(iniciativas).executar({ q: '   ', page: 1, limit: 20 });
    expect(iniciativas.filtrosAprovadas).toEqual([
      { q: undefined, tipo: undefined, page: 1, limit: 20 },
    ]);
  });

  it('devolve a página que a fachada entregou', async () => {
    const iniciativas = new IniciativasEmMemoria();
    const resultado = await new ListarAprovadas(iniciativas).executar({ page: 1, limit: 20 });
    expect(resultado).toEqual({ items: [], total: 0 });
  });
});

describe('ListarOcorrencias', () => {
  let iniciativas: IniciativasEmMemoria;
  let useCase: ListarOcorrencias;

  beforeEach(() => {
    iniciativas = new IniciativasEmMemoria();
    useCase = new ListarOcorrencias(iniciativas);
  });

  it('RN-12.1: gera as ocorrências e o link do Google Agenda de cada iniciativa', async () => {
    iniciativas.calendario = [aprovada({ fim: '2026-11-05' })];
    const resultado = await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-30',
      usuarioId: 'ana',
    });
    expect(resultado.map((o) => [o.inicio, o.fim, o.diaInteiro])).toEqual([
      ['2026-11-03', '2026-11-03', true],
      ['2026-11-04', '2026-11-04', true],
      ['2026-11-05', '2026-11-05', true],
    ]);
    expect(resultado[0]).toMatchObject({
      iniciativaId: 'i-1',
      titulo: 'Oficina de Python',
      tipo: 'EXTENSAO',
      espaco: 'Sala E122',
      organizadores: 'Ana Souza',
      periodicidade: 'DIARIA',
      periodoInicio: '2026-11-03',
      periodoFim: '2026-11-05',
    });
    expect(resultado[0].googleAgendaUrl).toContain('RRULE%3AFREQ%3DDAILY%3BUNTIL%3D20261105');
    expect(new Set(resultado.map((o) => o.googleAgendaUrl)).size).toBe(1);
  });

  it('RN-12.2: o dia `ate` fica de fora', async () => {
    iniciativas.calendario = [aprovada({})];
    const resultado = await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-05',
      usuarioId: 'ana',
    });
    expect(resultado.map((o) => o.inicio)).toEqual(['2026-11-03', '2026-11-04']);
  });

  it('RN-12.3: mensal começando no dia 31 cai no último dia do mês', async () => {
    iniciativas.calendario = [
      aprovada({ periodicidade: 'MENSAL', inicio: '2026-01-31', fim: '2026-06-30' }),
    ];
    const resultado = await useCase.executar({
      de: '2026-02-01',
      ate: '2026-04-01',
      usuarioId: 'ana',
    });
    expect(resultado.map((o) => o.inicio)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('RN-12.4: mais de 62 dias é 422 e não consulta iniciativas', async () => {
    const erro = await useCase
      .executar({ de: '2026-11-01', ate: '2027-01-03', usuarioId: 'ana' })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(Object.keys(erro.campos)).toEqual(['ate']);
    expect(iniciativas.filtrosCalendario).toEqual([]);
  });

  it('RN-12.4: 62 dias exatos é aceito', async () => {
    await expect(
      useCase.executar({ de: '2026-11-01', ate: '2027-01-02', usuarioId: 'ana' }),
    ).resolves.toEqual([]);
  });

  it('RN-12.4: de >= ate é 422', async () => {
    await expect(
      useCase.executar({ de: '2026-11-10', ate: '2026-11-10', usuarioId: 'ana' }),
    ).rejects.toBeInstanceOf(ValidacaoError);
  });

  it('RN-12.6: `minhas` filtra pelo autor logado; sem ele, sem filtro de autor', async () => {
    await useCase.executar({ de: '2026-11-01', ate: '2026-11-08', minhas: true, usuarioId: 'ana' });
    await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-08',
      minhas: false,
      usuarioId: 'ana',
    });
    await useCase.executar({ de: '2026-11-01', ate: '2026-11-08', usuarioId: 'ana' });
    expect(iniciativas.filtrosCalendario.map((f) => f.autorId)).toEqual([
      'ana',
      undefined,
      undefined,
    ]);
  });

  it('repassa os tipos escolhidos; lista vazia significa todos', async () => {
    await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-08',
      tipos: ['EVENTO', 'PESQUISA'],
      usuarioId: 'ana',
    });
    await useCase.executar({ de: '2026-11-01', ate: '2026-11-08', tipos: [], usuarioId: 'ana' });
    expect(iniciativas.filtrosCalendario.map((f) => f.tipos)).toEqual([
      ['EVENTO', 'PESQUISA'],
      undefined,
    ]);
  });

  it('ordena por início, misturando iniciativas, e ignora as sem ocorrência no intervalo', async () => {
    iniciativas.calendario = [
      aprovada({ id: 'b', periodicidade: 'EVENTO_UNICO', inicio: '2026-11-05', fim: '2026-11-06' }),
      aprovada({ id: 'a', periodicidade: 'EVENTO_UNICO', inicio: '2026-11-02', fim: '2026-11-02' }),
      aprovada({ id: 'c', periodicidade: 'EVENTO_UNICO', inicio: '2027-05-02', fim: '2027-05-02' }),
    ];
    const resultado = await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-30',
      usuarioId: 'ana',
    });
    expect(resultado.map((o) => [o.iniciativaId, o.inicio, o.fim])).toEqual([
      ['a', '2026-11-02', '2026-11-03'],
      ['b', '2026-11-05', '2026-11-07'],
    ]);
  });

  it('ocorrências com horário levam o horário em início e fim', async () => {
    iniciativas.calendario = [
      aprovada({
        periodicidade: 'SEMANAL',
        inicio: '2026-11-02',
        fim: '2026-11-30',
        horaInicio: '19:00',
        horaFim: '21:00',
      }),
    ];
    const resultado = await useCase.executar({
      de: '2026-11-01',
      ate: '2026-11-15',
      usuarioId: 'ana',
    });
    expect(resultado.map((o) => [o.inicio, o.fim, o.diaInteiro])).toEqual([
      ['2026-11-02T19:00', '2026-11-02T21:00', false],
      ['2026-11-09T19:00', '2026-11-09T21:00', false],
    ]);
  });
});

describe('DivulgacaoFacade', () => {
  it('googleAgendaUrl devolve o link do Google Agenda', () => {
    const url = new DivulgacaoFacade().googleAgendaUrl({
      titulo: 'Palestra',
      resumo: 'Resumo',
      inicio: '2026-11-10',
      fim: '2026-11-10',
      horaInicio: '14:00',
      horaFim: '16:00',
      periodicidade: 'EVENTO_UNICO',
      espaco: 'Auditório',
      organizadores: 'CIn',
    });
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/);
    expect(url).toContain('dates=20261110T140000%2F20261110T160000');
    expect(url).not.toContain('recur=');
  });
});
