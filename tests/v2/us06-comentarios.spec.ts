import { describe, expect, it, vi } from 'vitest';
import { ComentarIniciativa } from '@/modules/refinamento/application/use-cases/comentar-iniciativa';
import type { AutoresPort } from '@/modules/refinamento/application/ports/autores.port';
import type {
  EstadoIniciativa,
  IniciativaPort,
} from '@/modules/refinamento/application/ports/iniciativa.port';
import type { Comentario } from '@/modules/refinamento/domain/comentario';
import { IniciativaNaoEncontradaError } from '@/modules/refinamento/domain/errors/refinamento.errors';
import type { ComentarioPersistido } from '@/modules/refinamento/domain/ports/comentario.repository';
import { T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';
import { FakeClock } from '@/shared/testing/fake-clock';

/* ===========================================================================
 * US06 - COMENTAR INICIATIVA  |  Lacunas L3 e L5
 *
 * ESCOPO: caso de uso `ComentarIniciativa` com portas falsas (não há fakes do módulo
 * `refinamento` em testing/, então usa-se vi.fn()).
 *
 * NÃO TESTÁVEL EM NÍVEL UNITÁRIO (regra 5): exigir usuário autenticado e a validação do corpo
 * da requisição (CriarComentarioSchema, que só checa o TIPO string) são responsabilidade de
 * guard/pipe do Nest em presentation/http/comentarios.controller.ts. Exige teste HTTP.
 * ========================================================================= */

const MENSAGEM_VAZIA = 'Escreva sua sugestão antes de enviar.';
const txt = (n: number) => 'a'.repeat(n);

function montarComentar(estado: EstadoIniciativa | null = {
  id: 'ini-1',
  autorId: 'u-ana',
  status: 'EM_ANDAMENTO',
  ciclo: 1,
}) {
  const salvar = vi.fn(async (comentario: Comentario): Promise<ComentarioPersistido> => ({
    id: 'c-0001',
    ...comentario,
  }));
  const obterEstado = vi.fn(async (_id: string) => estado);
  const iniciativas: IniciativaPort = { obterEstado };
  const autores: AutoresPort = {
    mapaPorIds: async () =>
      new Map([['u-bruno', { id: 'u-bruno', nome: 'Bruno Lima', perfil: 'PROFESSOR' }]]),
  };
  const comentarios = { salvar, listarPorIniciativa: vi.fn(), contarPorCiclo: vi.fn() };
  const comentar = new ComentarIniciativa(comentarios, iniciativas, autores, new FakeClock(T0));
  return { comentar, salvar, obterEstado };
}

const enviar = (ctx: ReturnType<typeof montarComentar>, texto: string, iniciativaId = 'ini-1') =>
  ctx.comentar.executar({ iniciativaId, autorId: 'u-bruno', texto });

/* ------------------------------------------------------------------------- *
 * L3
 * ------------------------------------------------------------------------- */
describe('US06 - Comentar iniciativa (L3)', () => {
  it.each([
    ['vazio', ''],
    ['só espaços', '     '],
    ['só quebras de linha e tabulação', '\n\t \n'],
  ])(
    'US06 comentário com texto %s | Partição de Equivalência (classe inválida: texto vazio) | ValidacaoError "Escreva sua sugestão antes de enviar."',
    async (_descricao, texto) => {
      // Requisito: US06 - "Comentário com texto vazio ou só espaços -> erro (escreva sua sugestão
      //            antes de enviar)" (L3)
      // Técnica: Partição de Equivalência (vazio, só espaços, só espaços em branco variados)
      // Esperado: ValidacaoError com campos.texto = 'Escreva sua sugestão antes de enviar.' e nada salvo
      const ctx = montarComentar();

      const erro = await enviar(ctx, texto).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ValidacaoError);
      expect((erro as ValidacaoError).tipo).toBe('validacao');
      expect((erro as ValidacaoError).campos).toEqual({ texto: MENSAGEM_VAZIA });
      expect(ctx.salvar).not.toHaveBeenCalled();
    },
  );

  it('US06 comentário com mais de 1000 caracteres | Partição de Equivalência (classe inválida: texto longo) | ValidacaoError no campo texto', async () => {
    // Requisito: US06 - "Comentário com mais de 1000 caracteres -> erro de validação" (L3)
    // Técnica: Partição de Equivalência (texto muito acima do limite: 2000 caracteres)
    // Esperado: ValidacaoError com mensagem em campos.texto citando 1000 caracteres; nada salvo
    const ctx = montarComentar();

    const erro = await enviar(ctx, txt(2000)).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(Object.keys((erro as ValidacaoError).campos)).toEqual(['texto']);
    expect((erro as ValidacaoError).campos.texto).toContain('1000');
    expect(ctx.salvar).not.toHaveBeenCalled();
  });

  it('US06 comentário válido | Partição de Equivalência (classe válida) | salvo e retornado', async () => {
    // Requisito: US06 - "Comentário válido (até 1000 caracteres) -> salvo e retornado" (L3)
    // Técnica: Partição de Equivalência (classe válida: texto comum em iniciativa EM_ANDAMENTO)
    // Esperado: repositório recebe o comentário (iniciativa, ciclo 1, autor, texto) e o DTO
    //           devolvido traz id, ciclo, autor (nome/perfil), texto e criadoEm
    const ctx = montarComentar();

    const dto = await enviar(ctx, 'Sugiro um horário à tarde.');

    expect(ctx.salvar).toHaveBeenCalledTimes(1);
    expect(ctx.salvar).toHaveBeenCalledWith(
      expect.objectContaining({
        iniciativaId: 'ini-1',
        ciclo: 1,
        autorId: 'u-bruno',
        texto: 'Sugiro um horário à tarde.',
        criadoEm: T0,
      }),
    );
    expect(dto).toEqual({
      id: 'c-0001',
      ciclo: 1,
      autor: { id: 'u-bruno', nome: 'Bruno Lima', perfil: 'PROFESSOR', ehAutorDaIniciativa: false },
      texto: 'Sugiro um horário à tarde.',
      criadoEm: T0.toISOString(),
    });
  });

  it.each(['ini-inexistente', ''])(
    'US06 comentar iniciativa inexistente (id "%s") | Partição de Equivalência (classe inválida: iniciativa inexistente) | IniciativaNaoEncontradaError',
    async (id) => {
      // Requisito: US06 - "Iniciativa inexistente -> erro (iniciativa não encontrada)" (L3)
      // Técnica: Partição de Equivalência (id que não existe / id vazio)
      // Esperado: IniciativaNaoEncontradaError (nao_encontrado) 'Iniciativa não encontrada.'; nada salvo
      const ctx = montarComentar(null);

      const erro = await enviar(ctx, 'Boa ideia!', id).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(IniciativaNaoEncontradaError);
      expect((erro as IniciativaNaoEncontradaError).tipo).toBe('nao_encontrado');
      expect((erro as IniciativaNaoEncontradaError).message).toBe('Iniciativa não encontrada.');
      expect(ctx.obterEstado).toHaveBeenCalledWith(id);
      expect(ctx.salvar).not.toHaveBeenCalled();
    },
  );
});

/* ------------------------------------------------------------------------- *
 * L5 - valores-limite do texto: 0, 1, 1000 e 1001 caracteres
 * ------------------------------------------------------------------------- */
describe('US06 - Comentário: valores-limite do tamanho do texto (L5)', () => {
  it.each([
    [1, 'mínimo válido'],
    [1000, 'máximo válido'],
  ])(
    'US06 comentário com %i caractere(s) (%s) | Valor-Limite | aceito e salvo com o texto completo',
    async (tamanho) => {
      // Requisito: US06 - texto de 1 a 1000 caracteres é válido (L5)
      // Técnica: Valor-Limite (mínimo = 1, máximo = 1000)
      // Esperado: comentário salvo; o texto devolvido tem exatamente `tamanho` caracteres
      const ctx = montarComentar();

      const dto = await enviar(ctx, txt(tamanho));

      expect(dto.texto).toBe(txt(tamanho));
      expect(dto.texto).toHaveLength(tamanho);
      expect(ctx.salvar).toHaveBeenCalledTimes(1);
    },
  );

  it('US06 comentário com 0 caracteres | Valor-Limite (mínimo - 1) | ValidacaoError "Escreva sua sugestão antes de enviar." e nada salvo', async () => {
    // Requisito: US06 - texto vazio (0 caracteres) é inválido (L5)
    // Técnica: Valor-Limite (mínimo - 1 = 0)
    // Esperado: ValidacaoError com campos.texto = 'Escreva sua sugestão antes de enviar.'; repositório não é chamado
    const ctx = montarComentar();

    const erro = await enviar(ctx, txt(0)).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos).toEqual({ texto: MENSAGEM_VAZIA });
    expect(ctx.salvar).not.toHaveBeenCalled();
  });

  it('US06 comentário com 1001 caracteres | Valor-Limite (máximo + 1) | ValidacaoError no campo texto e nada salvo', async () => {
    // Requisito: US06 - texto acima de 1000 caracteres é inválido (L5)
    // Técnica: Valor-Limite (máximo + 1 = 1001)
    // Esperado: ValidacaoError só no campo texto, com mensagem citando o limite de 1000; repositório não é chamado
    const ctx = montarComentar();

    const erro = await enviar(ctx, txt(1001)).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(Object.keys((erro as ValidacaoError).campos)).toEqual(['texto']);
    expect((erro as ValidacaoError).campos.texto).toContain('1000');
    expect(ctx.salvar).not.toHaveBeenCalled();
  });
});
