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
    const sem = await submeter.executar('ana', entrada({ comVotacao: false }));
    const padrao = await submeter.executar('ana', entrada());
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
});
