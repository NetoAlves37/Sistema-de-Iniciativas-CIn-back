import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { DIA, entrada, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';
import {
  IniciativaNaoEncontradaError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from '../../domain/errors/iniciativas.errors';

describe('EditarIniciativa (RN-04)', () => {
  it('RN-04.1: o autor edita em EM_ANDAMENTO e o histórico registra a edição', async () => {
    const { editar, repositorio, eventos } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);

    await editar.executar(base.id, 'ana', entrada({ titulo: 'Novo título', comVotacao: false }));

    const gravada = repositorio.persistida(base.id);
    expect(gravada.dados.titulo).toBe('Novo título');
    expect(gravada.comVotacao).toBe(false);
    expect(gravada.version).toBe(1);
    expect(repositorio.historico.at(-1)).toMatchObject({
      de: 'EM_ANDAMENTO',
      para: 'EM_ANDAMENTO',
      nota: 'Iniciativa editada durante o refinamento',
    });
    expect(eventos.nomes()).toContain('IniciativaEditada');
  });

  it('RN-04.1: sem comVotacao no corpo, mantém o valor atual', async () => {
    const { editar, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .semVotacao()
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await editar.executar(base.id, 'ana', entrada());
    expect(repositorio.persistida(base.id).comVotacao).toBe(false);
  });

  it('RN-04.2: quem não é o autor recebe 403', async () => {
    const { editar, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await expect(editar.executar(base.id, 'bruno', entrada())).rejects.toBeInstanceOf(
      SomenteAutorError,
    );
  });

  it('RN-04.3: fora de EM_ANDAMENTO recebe 409', async () => {
    const { editar, repositorio } = montar();
    const base = umaIniciativa().doAutor('ana').emAnalise().construir();
    repositorio.semear(base);
    await expect(editar.executar(base.id, 'ana', entrada())).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });

  it('RN-04.4: com o prazo vencido e o job sem rodar, recebe 409 e a transição JÁ FICA aplicada', async () => {
    const { editar, repositorio, clock } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    clock.advance(2 * DIA);

    await expect(editar.executar(base.id, 'ana', entrada())).rejects.toThrow(
      'Iniciativas com status "Em votação" não podem ser editadas.',
    );

    expect(repositorio.persistida(base.id).status).toBe('EM_VOTACAO');
    expect(repositorio.historico.map((h) => h.para)).toEqual(['EM_VOTACAO']);
  });

  it('iniciativa inexistente: 404', async () => {
    const { editar } = montar();
    await expect(editar.executar('nao-existe', 'ana', entrada())).rejects.toBeInstanceOf(
      IniciativaNaoEncontradaError,
    );
  });

  it('RN-01 vale na edição: dados inválidos recebem 422 e nada muda', async () => {
    const { editar, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await expect(
      editar.executar(base.id, 'ana', entrada({ fim: '2020-01-01' })),
    ).rejects.toBeInstanceOf(ValidacaoError);
    expect(repositorio.persistida(base.id).version).toBe(0);
  });
});
