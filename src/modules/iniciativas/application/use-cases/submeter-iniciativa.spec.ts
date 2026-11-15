import { IniciativaDuplicadaError } from '@/modules/iniciativas/domain/errors/iniciativas.errors';
import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { DIA, entrada, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';

describe('SubmeterIniciativa (RN-01 a RN-03)', () => {
  it('RN-03.1: cria em EM_ANDAMENTO, ciclo 1, grava o histórico e publica o evento', async () => {
    const { submeter, repositorio, eventos } = montar();

    const id = await submeter.executar('ana', entrada());

    const gravada = repositorio.persistida(id);
    expect(gravada).toMatchObject({
      autorId: 'ana',
      status: 'EM_ANDAMENTO',
      ciclo: 1,
      comVotacao: true,
    });
    expect(repositorio.historico).toMatchObject([
      { para: 'EM_ANDAMENTO', por: 'ana', iniciativaId: id },
    ]);
    expect(eventos.nomes()).toEqual(['IniciativaSubmetida']);
  });

  it('RN-03.2: o prazo vem do Clock e da configuração', async () => {
    const { submeter, repositorio } = montar();
    const id = await submeter.executar('ana', entrada());
    expect(repositorio.persistida(id).fimRefinamento?.getTime()).toBe(T0.getTime() + 3 * DIA);
  });

  it('RN-03.3: comVotacao=false é persistido; omitido, o padrão é true', async () => {
    const { submeter, repositorio } = montar();
    // Títulos diferentes: a mesma submissão repetida seria recusada (409).
    const sem = await submeter.executar(
      'ana',
      entrada({ titulo: 'Sem votação', comVotacao: false }),
    );
    const padrao = await submeter.executar('ana', entrada({ titulo: 'Com votação' }));
    expect(repositorio.persistida(sem).comVotacao).toBe(false);
    expect(repositorio.persistida(padrao).comVotacao).toBe(true);
  });

  it('RN-01: dados inválidos lançam ValidacaoError com os campos e nada é gravado', async () => {
    const { submeter, repositorio } = montar();
    await expect(
      submeter.executar('ana', entrada({ titulo: '', participantes: 0 })),
    ).rejects.toMatchObject({
      campos: { titulo: 'Informe o título.', participantes: 'Informe um número maior que zero.' },
    });
    await expect(submeter.executar('ana', entrada({ titulo: '' }))).rejects.toBeInstanceOf(
      ValidacaoError,
    );
    expect(repositorio.historico).toEqual([]);
  });

  describe('submissão repetida (mesmo autor, título, data e horário de início)', () => {
    const comHorario = { horaInicio: '09:00', horaFim: '11:00' };

    it('a segunda submissão igual lança IniciativaDuplicadaError (409) e nada é gravado', async () => {
      const { submeter, repositorio, eventos } = montar();
      await submeter.executar('ana', entrada(comHorario));

      const erro = await submeter.executar('ana', entrada(comHorario)).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(IniciativaDuplicadaError);
      expect(erro).toMatchObject({ code: 'INICIATIVA_DUPLICADA', tipo: 'conflito' });
      expect(repositorio.historico).toHaveLength(1);
      expect(eventos.nomes()).toEqual(['IniciativaSubmetida']);
    });

    it('o título é comparado sem diferenciar maiúsculas', async () => {
      const { submeter } = montar();
      await submeter.executar('ana', entrada({ titulo: 'Semana de IA' }));
      await expect(
        submeter.executar('ana', entrada({ titulo: 'SEMANA DE IA' })),
      ).rejects.toBeInstanceOf(IniciativaDuplicadaError);
    });

    it('sem horário também conta: duas iguais de dia inteiro são duplicadas', async () => {
      const { submeter } = montar();
      await submeter.executar('ana', entrada({ horaInicio: undefined, horaFim: undefined }));
      await expect(
        submeter.executar('ana', entrada({ horaInicio: undefined, horaFim: undefined })),
      ).rejects.toBeInstanceOf(IniciativaDuplicadaError);
    });

    it.each([
      ['outro horário de início', 'ana', { horaInicio: '14:00', horaFim: '16:00' }],
      ['outra data de início', 'ana', { ...comHorario, inicio: '2030-05-11', fim: '2030-05-12' }],
      ['outro título', 'ana', { ...comHorario, titulo: 'Outro título' }],
      ['outro autor', 'bruno', comHorario],
    ])('%s: é aceita', async (_caso, autor, diferenca) => {
      const { submeter, repositorio } = montar();
      await submeter.executar('ana', entrada(comHorario));

      const id = await submeter.executar(autor, entrada(diferenca));

      expect(repositorio.persistida(id).status).toBe('EM_ANDAMENTO');
    });

    it.each([
      'EM_VOTACAO',
      'EM_ANALISE',
      'APROVADA',
    ] as const)('uma iniciativa igual em %s também impede', async (status) => {
      const { submeter, repositorio } = montar();
      repositorio.semear(
        umaIniciativa().doAutor('ana').noStatus(status).comDados(comHorario).construir(),
      );
      await expect(submeter.executar('ana', entrada(comHorario))).rejects.toBeInstanceOf(
        IniciativaDuplicadaError,
      );
    });

    it('uma iniciativa igual REPROVADA não impede (o caminho dela é ressubmeter)', async () => {
      const { submeter, repositorio } = montar();
      repositorio.semear(
        umaIniciativa().doAutor('ana').noStatus('REPROVADA').comDados(comHorario).construir(),
      );
      await expect(submeter.executar('ana', entrada(comHorario))).resolves.toBeTypeOf('string');
    });
  });
});
