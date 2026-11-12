import {
  PRAZOS_PADRAO,
  umaIniciativa,
} from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { DIA, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ConcorrenciaError } from '../../domain/errors/iniciativas.errors';

describe('CarregarComPrazos e job (RN-06)', () => {
  it('aplica a transição vencida, grava o histórico com o prazo vencido e publica os eventos', async () => {
    const { carregar, repositorio, clock, eventos } = montar();
    const fimRef = new Date(T0.getTime() + DIA);
    repositorio.semear(umaIniciativa().comId('i1').comPrazos(fimRef, null).construir());
    clock.advance(10 * DIA);

    const iniciativa = await carregar.executar('i1');

    expect(iniciativa?.status).toBe('EM_ANALISE');
    expect(repositorio.historico.map((h) => [h.de, h.para, h.por])).toEqual([
      ['EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA'],
      ['EM_VOTACAO', 'EM_ANALISE', 'SISTEMA'],
    ]);
    expect(repositorio.historico[0].ocorreuEm).toEqual(fimRef);
    expect(eventos.nomes()).toEqual(['RefinamentoEncerrado', 'VotacaoEncerrada']);
  });

  it('não grava nada quando não há prazo vencido', async () => {
    const { carregar, repositorio } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    await carregar.executar('i1');
    expect(repositorio.salvamentos).toBe(0);
  });

  it('devolve null quando a iniciativa não existe', async () => {
    const { carregar } = montar();
    expect(await carregar.executar('x')).toBeNull();
  });

  it('refaz a leitura quando perde a corrida de gravação (concorrência), sem duplicar histórico', async () => {
    const { carregar, repositorio, clock } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);
    const original = repositorio.salvar.bind(repositorio);
    let primeira = true;
    repositorio.salvar = async (iniciativa) => {
      if (primeira) {
        primeira = false;
        // Outra instância aplica a mesma transição antes.
        const outra = await repositorio.buscarPorId('i1');
        outra?.aplicarPrazosVencidos(clock, PRAZOS_PADRAO);
        if (outra) await original(outra);
      }
      return original(iniciativa);
    };

    const iniciativa = await carregar.executar('i1');

    expect(iniciativa?.status).toBe('EM_VOTACAO');
    expect(repositorio.historico.filter((h) => h.para === 'EM_VOTACAO')).toHaveLength(1);
  });

  it('RN-06.6 (versão): o job é idempotente e processa várias iniciativas', async () => {
    const { job, repositorio, clock } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    repositorio.semear(
      umaIniciativa()
        .comId('i2')
        .semVotacao()
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    repositorio.semear(
      umaIniciativa()
        .comId('i3')
        .comPrazos(new Date(T0.getTime() + 9 * DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);

    expect(await job.executar()).toBe(2);
    expect(await job.executar()).toBe(0);

    expect(repositorio.persistida('i1').status).toBe('EM_VOTACAO');
    expect(repositorio.persistida('i2').status).toBe('EM_ANALISE');
    expect(repositorio.persistida('i3').status).toBe('EM_ANDAMENTO');
    expect(repositorio.historico).toHaveLength(2);
  });

  it('o job ignora ConcorrenciaError (outra instância já processou) e propaga os demais erros', async () => {
    const { job, repositorio, clock, carregar } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);

    const original = carregar.executar.bind(carregar);
    carregar.executar = async () => {
      throw new ConcorrenciaError();
    };
    await expect(job.executar()).resolves.toBe(0);

    carregar.executar = async () => {
      throw new Error('falha inesperada');
    };
    await expect(job.executar()).rejects.toThrow('falha inesperada');
    carregar.executar = original;
  });
});
