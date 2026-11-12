import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { FakeClock } from '@/shared/testing/fake-clock';
import {
  AutorNaoPodeDecidirError,
  ConcorrenciaError,
  IniciativaNaoEncontradaError,
  TransicaoInvalidaError,
} from '../../domain/errors/iniciativas.errors';

describe('RegistrarDecisao (RN-10)', () => {
  it('RN-10.1 e RN-10.2: aprova e reprova (com justificativa), e publica IniciativaDecidida', async () => {
    const { decidir, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    repositorio.semear(umaIniciativa().comId('i2').doAutor('ana').emAnalise().construir());

    await decidir.executar('i1', 'carla', 'APROVADA', undefined);
    await decidir.executar('i2', 'elisa', 'REPROVADA', 'Sem espaço disponível.');

    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'carla' });
    expect(repositorio.persistida('i2')).toMatchObject({
      status: 'REPROVADA',
      justificativa: 'Sem espaço disponível.',
    });
    expect(eventos.nomes().filter((n) => n === 'IniciativaDecidida')).toHaveLength(2);
  });

  it('RN-10.4: o autor recebe 403', async () => {
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('carla').emAnalise().construir());
    await expect(decidir.executar('i1', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      AutorNaoPodeDecidirError,
    );
  });

  it('RN-10.5: fora de EM_ANALISE recebe 409', async () => {
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').construir());
    await expect(decidir.executar('i1', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });

  it('RN-10.6 (versão): a decisão concorrente que perde a corrida recebe 409 "já foi decidida"', async () => {
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    // Simula o outro membro do comitê gravando entre a leitura e a escrita.
    const original = repositorio.salvar.bind(repositorio);
    let primeira = true;
    repositorio.salvar = async (iniciativa) => {
      if (primeira) {
        primeira = false;
        const concorrente = await repositorio.buscarPorId('i1');
        concorrente?.decidir('APROVADA', undefined, 'elisa', new FakeClock(T0));
        if (concorrente) await original(concorrente);
      }
      return original(iniciativa);
    };

    const tentativa = decidir.executar('i1', 'carla', 'REPROVADA', 'x');

    await expect(tentativa).rejects.toBeInstanceOf(ConcorrenciaError);
    await expect(tentativa).rejects.toThrow('Esta iniciativa já foi decidida.');
    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'elisa' });
  });

  it('iniciativa inexistente: 404', async () => {
    const { decidir } = montar();
    await expect(decidir.executar('x', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      IniciativaNaoEncontradaError,
    );
  });
});
