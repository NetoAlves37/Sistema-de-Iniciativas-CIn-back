import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { DIA, entrada, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { SomenteAutorError, TransicaoInvalidaError } from '../../domain/errors/iniciativas.errors';

describe('RessubmeterIniciativa (RN-11)', () => {
  it('RN-11.1: reabre o refinamento no ciclo seguinte, com a justificativa anterior no histórico', async () => {
    const { ressubmeter, repositorio, eventos } = montar();
    const base = umaIniciativa().doAutor('ana').reprovada('Ajustar o espaço.').construir();
    repositorio.semear(base);

    await ressubmeter.executar(base.id, 'ana', entrada({ titulo: 'Revisado', comVotacao: false }));

    const gravada = repositorio.persistida(base.id);
    expect(gravada).toMatchObject({
      status: 'EM_ANDAMENTO',
      ciclo: 2,
      comVotacao: false,
      fimVotacao: null,
      decisorId: null,
      justificativa: null,
    });
    expect(gravada.dados.titulo).toBe('Revisado');
    expect(gravada.fimRefinamento?.getTime()).toBe(T0.getTime() + 3 * DIA);
    expect(repositorio.historico.at(-1)).toMatchObject({
      nota: 'Ressubmetida após reprovação (ciclo 2)',
    });
    expect(eventos.nomes()).toContain('IniciativaRessubmetida');
  });

  it('RN-11.2 e RN-11.3: 403 para outro usuário e 409 fora de REPROVADA', async () => {
    const { ressubmeter, repositorio } = montar();
    const reprovada = umaIniciativa().comId('r1').doAutor('ana').reprovada().construir();
    const aprovada = umaIniciativa().comId('a1').doAutor('ana').aprovada().construir();
    repositorio.semear(reprovada);
    repositorio.semear(aprovada);
    await expect(ressubmeter.executar('r1', 'bruno', entrada())).rejects.toBeInstanceOf(
      SomenteAutorError,
    );
    await expect(ressubmeter.executar('a1', 'ana', entrada())).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });
});
