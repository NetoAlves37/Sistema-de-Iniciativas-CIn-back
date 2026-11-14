import { describe, expect, it, vi } from 'vitest';
import { AlterarIniciativa } from '@/modules/iniciativas/application/use-cases/alterar-iniciativa';
import {
  ConcorrenciaError,
  IniciativaNaoEncontradaError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from '@/modules/iniciativas/domain/errors/iniciativas.errors';
import type { Iniciativa } from '@/modules/iniciativas/domain/iniciativa';
import { ROTULO_STATUS } from '@/modules/iniciativas/domain/status';
import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import {
  DIA,
  entrada,
  montar,
  T0,
} from '@/modules/iniciativas/testing/montar-casos-de-uso';
import type { TransacaoPort } from '@/shared/domain/transacao.port';
import { montarPainel } from './helpers/painel-em-memoria';

const transacaoSimples: TransacaoPort = { run: (trabalho) => trabalho() };
const TITULO_ORIGINAL = 'Hackathon de Acessibilidade Digital'; // título de dadosValidos()

/* ===========================================================================
 * L6 - US01: após a submissão, a iniciativa aparece no painel com status Em andamento
 * ========================================================================= */
describe('US01 - Submissão aparece no painel (L6)', () => {
  it('US01 iniciativa submetida aparece no painel | Partição de Equivalência (classe válida) | status Em andamento', async () => {
    // Requisito: US01 - "após a submissão, a iniciativa aparece no painel com status Em andamento" (L6)
    // Técnica: Partição de Equivalência (classe válida: submissão com dados corretos)
    // Esperado: o painel lista exatamente a iniciativa criada, com status EM_ANDAMENTO (rótulo
    //           "Em andamento"), título e autor da submissão
    const ctx = montarPainel();

    const id = await ctx.submeter.executar('ana', entrada({ titulo: 'Oficina de Git' }));
    ctx.leitura.acompanhar(id);
    const painel = await ctx.consultas.listar({ page: 1, limit: 20 });

    expect(painel.total).toBe(1);
    expect(painel.items[0]).toMatchObject({
      id,
      titulo: 'Oficina de Git',
      status: 'EM_ANDAMENTO',
      autor: { id: 'ana', nome: 'Ana Souza', perfil: 'ALUNO' },
    });
    expect(ROTULO_STATUS[painel.items[0].status]).toBe('Em andamento');
  });

  it('US01 iniciativa submetida aparece em "minhas" e na contagem | Partição de Equivalência (classe válida) | 1 em EM_ANDAMENTO', async () => {
    // Requisito: US01 - após a submissão, a iniciativa aparece no painel (L6), na visão do autor
    // Técnica: Partição de Equivalência (autor que acabou de submeter)
    // Esperado: "minhas" da ana traz a iniciativa EM_ANDAMENTO e contagemPorStatus.EM_ANDAMENTO = 1
    const ctx = montarPainel();

    const id = await ctx.submeter.executar('ana', entrada());
    ctx.leitura.acompanhar(id);
    const minhas = await ctx.consultas.minhas('ana', { page: 1, limit: 20 });

    expect(minhas.items.map((i) => [i.id, i.status])).toEqual([[id, 'EM_ANDAMENTO']]);
    expect(minhas.contagemPorStatus).toMatchObject({ EM_ANDAMENTO: 1 });
  });
});

/* ===========================================================================
 * L7 - US02: acesso negado a quem não é do comitê/admin; painel atualizado após avaliar
 *
 * NÃO TESTÁVEL EM NÍVEL UNITÁRIO (regra 5): o "acesso negado" (403) a um usuário sem papel
 * de comitê/administrador depende de guard/roles do Nest. No código fornecido não há rota de
 * decisão em IniciativasController; `IniciativasFacade.registrarDecisao` é chamada pelo módulo
 * de avaliação (não fornecido). ATENÇÃO: `DecidirIniciativa.executar` NÃO recebe nem confere
 * papel (só `decisorId`), então um decisor sem papel de comitê seria aceito se o guard falhar.
 * Isso só se prova com teste de integração/HTTP no módulo de avaliação. O que é testável aqui é
 * a permissão calculada no domínio (`permissoes.podeDecidir`), que o front usa para liberar a ação.
 * ========================================================================= */
describe('US02 - Avaliação: permissão e painel (L7)', () => {
  it.each([
    ['usuário comum (não é do comitê nem admin)', { id: 'bruno', nome: 'Bruno Lima', ehComite: false }, false],
    ['autor comum da iniciativa', { id: 'ana', nome: 'Ana Souza', ehComite: false }, false],
    ['membro do comitê ou administrador (não autor)', { id: 'carla', nome: 'Carla Menezes', ehComite: true }, true],
  ])(
    'US02 permissão de avaliar - %s | Partição de Equivalência (perfis) | podeDecidir = %s',
    async (_perfil, ator, podeDecidirEsperado) => {
      // Requisito: US02 - usuário que não é do comitê nem administrador não pode avaliar (L7)
      // Técnica: Partição de Equivalência (perfil sem papel de comitê x com papel de comitê/admin)
      // Esperado: iniciativa EM_ANALISE da ana: podeDecidir false para quem não é comitê/admin;
      //           true para comitê/admin que não é o autor
      const ctx = montarPainel();
      ctx.leitura.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());

      const detalhe = await ctx.consultas.detalhe('i1', ator);

      expect(detalhe.status).toBe('EM_ANALISE');
      expect(detalhe.permissoes.podeDecidir).toBe(podeDecidirEsperado);
    },
  );

  it('US02 após aprovar, o painel filtrado por status é atualizado | Partição de Equivalência (antes x depois) | sai de EM_ANALISE e entra em APROVADA', async () => {
    // Requisito: US02 - "após avaliação, o status é atualizado no painel" (L7)
    // Técnica: Partição de Equivalência (estado antes x depois da decisão APROVADA)
    // Esperado: antes: filtro EM_ANALISE traz i1 e APROVADA traz nada; depois: o inverso
    const ctx = montarPainel();
    ctx.leitura.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    const ids = async (status: 'EM_ANALISE' | 'APROVADA') =>
      (await ctx.consultas.listar({ status, page: 1, limit: 20 })).items.map((i) => i.id);

    expect(await ids('EM_ANALISE')).toEqual(['i1']);
    expect(await ids('APROVADA')).toEqual([]);

    await ctx.decidir.executar('i1', 'carla', 'APROVADA', undefined);

    expect(await ids('EM_ANALISE')).toEqual([]);
    expect(await ids('APROVADA')).toEqual(['i1']);
  });

  it('US02 após reprovar, "minhas" e a contagem refletem o novo status | Partição de Equivalência (resultado REPROVADA) | contagem passa de EM_ANALISE para REPROVADA', async () => {
    // Requisito: US02 - "após avaliação, o status é atualizado no painel" (L7), visão do autor
    // Técnica: Partição de Equivalência (resultado REPROVADA com justificativa)
    // Esperado: antes: { EM_ANALISE: 1 }; depois: i1 aparece como REPROVADA e a contagem de
    //           EM_ANALISE zera (ausente ou 0) com REPROVADA = 1
    const ctx = montarPainel();
    ctx.leitura.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());

    const antes = await ctx.consultas.minhas('ana', { page: 1, limit: 20 });
    expect(antes.contagemPorStatus).toMatchObject({ EM_ANALISE: 1 });

    await ctx.decidir.executar('i1', 'carla', 'REPROVADA', 'Sem espaço disponível.');

    const depois = await ctx.consultas.minhas('ana', { page: 1, limit: 20 });
    expect(depois.items.map((i) => [i.id, i.status])).toEqual([['i1', 'REPROVADA']]);
    expect(depois.contagemPorStatus).toMatchObject({ REPROVADA: 1 });
    expect(depois.contagemPorStatus.EM_ANALISE ?? 0).toBe(0);
  });
});

/* ===========================================================================
 * L8 - Decisão concorrente (decidir-iniciativa.ts)
 * ========================================================================= */
describe('US02 - Decisão concorrente (L8)', () => {
  it('US02 duas decisões ao mesmo tempo | Partição de Equivalência (concorrência) | a segunda recebe ConcorrenciaError "Esta iniciativa já foi decidida."', async () => {
    // Requisito: US02 / RN-10 - a segunda decisão concorrente recebe ConcorrenciaError (409) com
    //            a mensagem "Esta iniciativa já foi decidida." (L8)
    // Técnica: Partição de Equivalência (duas decisões disparadas juntas sobre a mesma versão)
    // Esperado: exatamente uma decisão é gravada; a outra rejeita com ConcorrenciaError (tipo
    //           'conflito') e a mensagem acima; só uma transição de decisão no histórico, só um
    //           evento IniciativaDecidida, e o estado final é o da decisão que venceu
    const { decidir, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    const decisores = ['carla', 'elisa'];

    const resultados = await Promise.allSettled([
      decidir.executar('i1', decisores[0], 'APROVADA', undefined),
      decidir.executar('i1', decisores[1], 'REPROVADA', 'Sem espaço disponível.'),
    ]);

    const vencedora = resultados.findIndex((r) => r.status === 'fulfilled');
    const rejeitadas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0].reason).toBeInstanceOf(ConcorrenciaError);
    expect(rejeitadas[0].reason.tipo).toBe('conflito');
    expect(rejeitadas[0].reason.message).toBe('Esta iniciativa já foi decidida.');

    const gravada = repositorio.persistida('i1');
    expect(gravada.decisorId).toBe(decisores[vencedora]);
    expect(gravada.status).toBe(vencedora === 0 ? 'APROVADA' : 'REPROVADA');
    expect(gravada.version).toBe(1);
    expect(
      repositorio.historico.filter((h) => h.para === 'APROVADA' || h.para === 'REPROVADA'),
    ).toHaveLength(1);
    expect(eventos.nomes().filter((n) => n === 'IniciativaDecidida')).toHaveLength(1);
  });
});

/* ===========================================================================
 * L9 - Iniciativa inexistente em alterar-iniciativa.ts
 * ========================================================================= */
describe('Iniciativa inexistente em AlterarIniciativa (L9)', () => {
  it('L9 alterar iniciativa inexistente | Partição de Equivalência (classe inválida: id inexistente) | IniciativaNaoEncontradaError', async () => {
    // Requisito: alterar-iniciativa.ts - iniciativa inexistente lança IniciativaNaoEncontradaError (L9)
    // Técnica: Partição de Equivalência (id que não existe no repositório)
    // Esperado: IniciativaNaoEncontradaError (nao_encontrado, 'Iniciativa não encontrada.'); a
    //           mudança nunca é executada, nada é salvo e nenhum evento é publicado
    const ctx = montar();
    const alterar = new AlterarIniciativa(ctx.repositorio, transacaoSimples, ctx.eventos, ctx.carregar);
    const mudar = vi.fn();

    const erro = await alterar.executar('nao-existe', mudar).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(IniciativaNaoEncontradaError);
    expect((erro as IniciativaNaoEncontradaError).tipo).toBe('nao_encontrado');
    expect((erro as IniciativaNaoEncontradaError).message).toBe('Iniciativa não encontrada.');
    expect(mudar).not.toHaveBeenCalled();
    expect(ctx.repositorio.salvamentos).toBe(0);
    expect(ctx.eventos.publicados).toEqual([]);
  });

  it.each(['editar', 'ressubmeter', 'decidir'] as const)(
    'L9 caso de uso %s com iniciativa inexistente | Partição de Equivalência (classe inválida: id inexistente) | propaga IniciativaNaoEncontradaError',
    async (casoDeUso) => {
      // Requisito: editar, ressubmeter e decidir passam por AlterarIniciativa; id inexistente (L9)
      // Técnica: Partição de Equivalência (id inexistente em cada caso de uso que usa AlterarIniciativa)
      // Esperado: IniciativaNaoEncontradaError e nada gravado
      const ctx = montar();
      const chamadas = {
        editar: () => ctx.editar.executar('nao-existe', 'ana', entrada()),
        ressubmeter: () => ctx.ressubmeter.executar('nao-existe', 'ana', entrada()),
        decidir: () => ctx.decidir.executar('nao-existe', 'carla', 'APROVADA', undefined),
      };

      const erro = await chamadas[casoDeUso]().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(IniciativaNaoEncontradaError);
      expect((erro as IniciativaNaoEncontradaError).message).toBe('Iniciativa não encontrada.');
      expect(ctx.repositorio.salvamentos).toBe(0);
    },
  );
});

/* ===========================================================================
 * L10 - Casos de uso EditarIniciativa e RessubmeterIniciativa (pelo caso de uso)
 * ========================================================================= */
describe('US05 - EditarIniciativa (caso de uso) (L10)', () => {
  it('US05 autor edita em EM_ANDAMENTO | Partição de Equivalência (classe válida) | dados atualizados, status mantido', async () => {
    // Requisito: US05 - o autor edita a iniciativa em EM_ANDAMENTO (L10)
    // Técnica: Partição de Equivalência (classe válida: autor + EM_ANDAMENTO)
    // Esperado: título novo gravado, status segue EM_ANDAMENTO, ciclo 1, versão 1 e evento IniciativaEditada
    const { editar, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').construir());

    await editar.executar('i1', 'ana', entrada({ titulo: 'Novo título' }));

    const gravada = repositorio.persistida('i1');
    expect(gravada.dados.titulo).toBe('Novo título');
    expect(gravada.status).toBe('EM_ANDAMENTO');
    expect(gravada.ciclo).toBe(1);
    expect(gravada.version).toBe(1);
    expect(eventos.nomes()).toEqual(['IniciativaEditada']);
  });

  it('US05 não autor tenta editar | Partição de Equivalência (classe inválida: não autor) | SomenteAutorError e nada muda', async () => {
    // Requisito: US05 - só o autor edita a iniciativa (L10)
    // Técnica: Partição de Equivalência (usuário diferente do autor)
    // Esperado: SomenteAutorError (proibido) 'Só o autor pode editar esta iniciativa.'; dados,
    //           versão e eventos inalterados
    const { editar, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').construir());

    const erro = await editar.executar('i1', 'bruno', entrada({ titulo: 'Invasor' })).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(SomenteAutorError);
    expect((erro as SomenteAutorError).tipo).toBe('proibido');
    expect((erro as SomenteAutorError).message).toBe('Só o autor pode editar esta iniciativa.');
    expect(repositorio.persistida('i1').dados.titulo).toBe(TITULO_ORIGINAL);
    expect(repositorio.persistida('i1').version).toBe(0);
    expect(eventos.publicados).toEqual([]);
  });

  const semeadoresEdicao: Record<string, () => Iniciativa> = {
    EM_VOTACAO: () => umaIniciativa().comId('i1').doAutor('ana').emVotacao().construir(),
    EM_ANALISE: () => umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir(),
    APROVADA: () => umaIniciativa().comId('i1').doAutor('ana').aprovada().construir(),
    REPROVADA: () => umaIniciativa().comId('i1').doAutor('ana').reprovada().construir(),
  };

  it.each(Object.keys(semeadoresEdicao))(
    'US05 autor tenta editar em %s | Partição de Equivalência (classe inválida: status diferente de EM_ANDAMENTO) | TransicaoInvalidaError e nada muda',
    async (status) => {
      // Requisito: US05 - edição só é permitida em EM_ANDAMENTO (L10)
      // Técnica: Partição de Equivalência (cada status diferente de EM_ANDAMENTO)
      // Esperado: TransicaoInvalidaError (conflito) com status atual e operação 'editar'; a
      //           iniciativa continua no mesmo status, com o mesmo título e versão 0
      const { editar, repositorio } = montar();
      repositorio.semear(semeadoresEdicao[status]());

      const erro = await editar.executar('i1', 'ana', entrada({ titulo: 'Novo título' })).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(TransicaoInvalidaError);
      expect(erro).toMatchObject({ tipo: 'conflito', status, operacao: 'editar' });
      expect(repositorio.persistida('i1')).toMatchObject({ status, version: 0 });
      expect(repositorio.persistida('i1').dados.titulo).toBe(TITULO_ORIGINAL);
    },
  );
});

describe('US05 - RessubmeterIniciativa (caso de uso) (L10)', () => {
  it('US05 autor ressubmete iniciativa REPROVADA | Partição de Equivalência (classe válida) | ciclo +1, EM_ANDAMENTO e decisão limpa', async () => {
    // Requisito: US05 - ressubmissão incrementa o ciclo e volta a EM_ANDAMENTO (L10)
    // Técnica: Partição de Equivalência (classe válida: autor + REPROVADA)
    // Esperado: ciclo 1 -> 2, status EM_ANDAMENTO, dados novos, decisão e justificativa limpas,
    //           refinamento reaberto (fimRefinamento = agora + 3 dias) e evento IniciativaRessubmetida
    const { ressubmeter, repositorio, eventos } = montar();
    repositorio.semear(
      umaIniciativa().comId('i1').doAutor('ana').reprovada('Ajustar o espaço.').construir(),
    );

    await ressubmeter.executar('i1', 'ana', entrada({ titulo: 'Revisado' }));

    const gravada = repositorio.persistida('i1');
    expect(gravada).toMatchObject({
      status: 'EM_ANDAMENTO',
      ciclo: 2,
      decisorId: null,
      justificativa: null,
      version: 1,
    });
    expect(gravada.dados.titulo).toBe('Revisado');
    expect(gravada.fimRefinamento?.getTime()).toBe(T0.getTime() + 3 * DIA);
    expect(eventos.nomes()).toEqual(['IniciativaRessubmetida']);
  });

  it('US05 não autor tenta ressubmeter | Partição de Equivalência (classe inválida: não autor) | SomenteAutorError e nada muda', async () => {
    // Requisito: US05 - só o autor ressubmete (L10)
    // Técnica: Partição de Equivalência (usuário diferente do autor)
    // Esperado: SomenteAutorError (proibido) 'Só o autor pode ressubmeter esta iniciativa.'; a
    //           iniciativa segue REPROVADA, ciclo 1, versão 0
    const { ressubmeter, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').reprovada().construir());

    const erro = await ressubmeter.executar('i1', 'bruno', entrada()).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(SomenteAutorError);
    expect((erro as SomenteAutorError).tipo).toBe('proibido');
    expect((erro as SomenteAutorError).message).toBe('Só o autor pode ressubmeter esta iniciativa.');
    expect(repositorio.persistida('i1')).toMatchObject({ status: 'REPROVADA', ciclo: 1, version: 0 });
    expect(eventos.publicados).toEqual([]);
  });

  const semeadoresRessubmissao: Record<string, () => Iniciativa> = {
    EM_ANDAMENTO: () => umaIniciativa().comId('i1').doAutor('ana').emAndamento().construir(),
    EM_VOTACAO: () => umaIniciativa().comId('i1').doAutor('ana').emVotacao().construir(),
    EM_ANALISE: () => umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir(),
    APROVADA: () => umaIniciativa().comId('i1').doAutor('ana').aprovada().construir(),
  };

  it.each(Object.keys(semeadoresRessubmissao))(
    'US05 autor tenta ressubmeter em %s | Partição de Equivalência (classe inválida: status diferente de REPROVADA) | TransicaoInvalidaError e nada muda',
    async (status) => {
      // Requisito: US05 - ressubmissão só é permitida em REPROVADA (L10)
      // Técnica: Partição de Equivalência (cada status diferente de REPROVADA)
      // Esperado: TransicaoInvalidaError (conflito) com status atual e operação 'ressubmeter'; a
      //           iniciativa continua no mesmo status e ciclo 1, versão 0
      const { ressubmeter, repositorio } = montar();
      repositorio.semear(semeadoresRessubmissao[status]());

      const erro = await ressubmeter.executar('i1', 'ana', entrada({ titulo: 'Revisado' })).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(TransicaoInvalidaError);
      expect(erro).toMatchObject({ tipo: 'conflito', status, operacao: 'ressubmeter' });
      expect(repositorio.persistida('i1')).toMatchObject({ status, ciclo: 1, version: 0 });
      expect(repositorio.persistida('i1').dados.titulo).toBe(TITULO_ORIGINAL);
    },
  );
});
