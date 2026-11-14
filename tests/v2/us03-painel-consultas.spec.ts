import { describe, expect, it, vi } from 'vitest';
import type { StatusIniciativa } from '@/modules/iniciativas/domain/status';
import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { montarPainel } from './helpers/painel-em-memoria';

/* ===========================================================================
 * US03 - CONSULTAS DE INICIATIVAS (PAINEL)  |  Lacuna L1
 *
 * ESCOPO: `ConsultasIniciativas` (listar / minhas) lendo de um fake em memória do
 * `IniciativaLeituraPort` (tests/v2/helpers/painel-em-memoria.ts).
 *
 * NÃO TESTÁVEL EM NÍVEL UNITÁRIO (regra 5): o filtro, a contagem e a paginação reais são SQL em
 * infrastructure/persistence/iniciativa-listagem.query.ts (JOIN/WHERE/GROUP BY no Postgres) e a
 * rota HTTP (GET /iniciativas, GET /iniciativas/minhas) depende do guard/@GetCurrentUser do Nest.
 * Isso exige teste de integração com banco. Aqui verifica-se o que o caso de uso faz: repassa o
 * filtro e o usuário autenticado à porta e devolve o resultado mapeado.
 * ========================================================================= */

const TODOS_OS_STATUS: StatusIniciativa[] = [
  'EM_ANDAMENTO',
  'EM_VOTACAO',
  'EM_ANALISE',
  'APROVADA',
  'REPROVADA',
];

/** Semeia uma iniciativa de cada status, todas da autora `ana`. */
function semearUmaDeCadaStatus(ctx: ReturnType<typeof montarPainel>) {
  ctx.leitura.semear(
    umaIniciativa().comId('i-andamento').doAutor('ana').emAndamento().construir(),
    umaIniciativa().comId('i-votacao').doAutor('ana').emVotacao().construir(),
    umaIniciativa().comId('i-analise').doAutor('ana').emAnalise().construir(),
    umaIniciativa().comId('i-aprovada').doAutor('ana').aprovada().construir(),
    umaIniciativa().comId('i-reprovada').doAutor('ana').reprovada().construir(),
  );
}

describe('US03 - Painel de iniciativas (consultas)', () => {
  it('US03 visualizar iniciativas no painel | Partição de Equivalência (um representante de cada status) | cada iniciativa é exibida com o seu status', async () => {
    // Requisito: US03 - "Visualizar iniciativas no painel de status" (L1)
    // Técnica: Partição de Equivalência (uma iniciativa em cada um dos 5 status)
    // Esperado: as 5 iniciativas aparecem (total 5) e cada id vem com o status em que foi gravada
    const ctx = montarPainel();
    semearUmaDeCadaStatus(ctx);

    const pagina = await ctx.consultas.listar({ page: 1, limit: 20 });

    expect(pagina.total).toBe(5);
    expect(Object.fromEntries(pagina.items.map((i) => [i.id, i.status]))).toEqual({
      'i-andamento': 'EM_ANDAMENTO',
      'i-votacao': 'EM_VOTACAO',
      'i-analise': 'EM_ANALISE',
      'i-aprovada': 'APROVADA',
      'i-reprovada': 'REPROVADA',
    });
  });

  it('US03 visualizar iniciativas no painel | Partição de Equivalência (dados de exibição) | item traz título, autor e prazo atual', async () => {
    // Requisito: US03 - iniciativas exibidas com seus status (dados mostrados no cartão)
    // Técnica: Partição de Equivalência (iniciativa EM_ANDAMENTO com refinamento aberto)
    // Esperado: título, autor (id, nome e perfil) e prazoAtual = fimRefinamento em ISO
    const ctx = montarPainel();
    const fimRefinamento = new Date(T0.getTime() + 2 * 24 * 60 * 60 * 1000);
    ctx.leitura.semear(
      umaIniciativa()
        .comId('i1')
        .doAutor('ana')
        .comDados({ titulo: 'Oficina de Git' })
        .comPrazos(fimRefinamento, null)
        .construir(),
    );

    const { items } = await ctx.consultas.listar({ page: 1, limit: 20 });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'i1',
      titulo: 'Oficina de Git',
      status: 'EM_ANDAMENTO',
      autor: { id: 'ana', nome: 'Ana Souza', perfil: 'ALUNO' },
      prazoAtual: fimRefinamento.toISOString(),
    });
  });

  it('US03 visualizar minhas iniciativas | Partição de Equivalência (usuário com propostas) | só as propostas do usuário autenticado', async () => {
    // Requisito: US03 - "Visualizar minhas iniciativas" -> propostas do usuário autenticado exibidas (L1)
    // Técnica: Partição de Equivalência (iniciativas da ana x iniciativa de outro autor)
    // Esperado: só i-ana-1 e i-ana-2, total 2, nenhuma do bruno; a porta recebe autorId = 'ana'
    const ctx = montarPainel();
    ctx.leitura.semear(
      umaIniciativa().comId('i-ana-1').doAutor('ana').construir(),
      umaIniciativa().comId('i-ana-2').doAutor('ana').emAnalise().construir(),
      umaIniciativa().comId('i-bruno-1').doAutor('bruno').construir(),
    );
    const listar = vi.spyOn(ctx.leitura, 'listar');

    const resultado = await ctx.consultas.minhas('ana', { page: 1, limit: 20 });

    expect(resultado.items.map((i) => i.id).sort()).toEqual(['i-ana-1', 'i-ana-2']);
    expect(resultado.total).toBe(2);
    expect(resultado.items.every((i) => i.autor.id === 'ana')).toBe(true);
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ autorId: 'ana' }));
  });

  it('US03 visualizar minhas iniciativas | Partição de Equivalência (usuário sem propostas) | lista vazia e nenhuma contagem', async () => {
    // Requisito: US03 - minhas iniciativas de quem ainda não submeteu nada (L1)
    // Técnica: Partição de Equivalência (classe: usuário sem propostas)
    // Esperado: items [], total 0, contagemPorStatus {} (a iniciativa do bruno não vaza para a carla)
    const ctx = montarPainel();
    ctx.leitura.semear(umaIniciativa().comId('i-bruno-1').doAutor('bruno').construir());

    const resultado = await ctx.consultas.minhas('carla', { page: 1, limit: 20 });

    expect(resultado.items).toEqual([]);
    expect(resultado.total).toBe(0);
    expect(resultado.contagemPorStatus).toEqual({});
  });

  it.each(TODOS_OS_STATUS)(
    'US03 filtrar por status %s | Partição de Equivalência (um filtro por status) | só as iniciativas desse status',
    async (status) => {
      // Requisito: US03 - "Filtrar iniciativas por status" -> iniciativas correspondentes exibidas (L1)
      // Técnica: Partição de Equivalência (cada um dos 5 status como filtro)
      // Esperado: todos os itens têm o status filtrado e é exatamente a iniciativa semeada nele
      const ctx = montarPainel();
      semearUmaDeCadaStatus(ctx);
      const idEsperado: Record<StatusIniciativa, string> = {
        EM_ANDAMENTO: 'i-andamento',
        EM_VOTACAO: 'i-votacao',
        EM_ANALISE: 'i-analise',
        APROVADA: 'i-aprovada',
        REPROVADA: 'i-reprovada',
      };

      const pagina = await ctx.consultas.listar({ status, page: 1, limit: 20 });

      expect(pagina.total).toBe(1);
      expect(pagina.items.map((i) => [i.id, i.status])).toEqual([[idEsperado[status], status]]);
    },
  );

  it('US03 filtrar por status com várias iniciativas | Partição de Equivalência (filtro com mais de um resultado) | só as do status, e o filtro chega à porta', async () => {
    // Requisito: US03 - filtrar por status (L1)
    // Técnica: Partição de Equivalência (2 iniciativas EM_ANALISE + 2 de outros status)
    // Esperado: as 2 EM_ANALISE e mais nenhuma; a porta recebe status = 'EM_ANALISE'
    const ctx = montarPainel();
    ctx.leitura.semear(
      umaIniciativa().comId('a1').doAutor('ana').emAnalise().construir(),
      umaIniciativa().comId('a2').doAutor('bruno').emAnalise().construir(),
      umaIniciativa().comId('b1').doAutor('ana').aprovada().construir(),
      umaIniciativa().comId('c1').doAutor('bruno').emAndamento().construir(),
    );
    const listar = vi.spyOn(ctx.leitura, 'listar');

    const pagina = await ctx.consultas.listar({ status: 'EM_ANALISE', page: 1, limit: 20 });

    expect(pagina.items.map((i) => i.id).sort()).toEqual(['a1', 'a2']);
    expect(pagina.total).toBe(2);
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ status: 'EM_ANALISE' }));
  });

  it('US03 filtrar por status sem correspondência | Partição de Equivalência (resultado vazio) | lista vazia', async () => {
    // Requisito: US03 - filtrar por status quando nenhuma iniciativa tem o status (L1)
    // Técnica: Partição de Equivalência (classe: filtro sem resultado)
    // Esperado: items [] e total 0
    const ctx = montarPainel();
    ctx.leitura.semear(umaIniciativa().comId('a1').doAutor('ana').emAndamento().construir());

    const pagina = await ctx.consultas.listar({ status: 'REPROVADA', page: 1, limit: 20 });

    expect(pagina).toEqual({ items: [], total: 0 });
  });

  it('US03 visualizar contagem por status | Partição de Equivalência (vários status do mesmo autor) | contagem por status apresentada', async () => {
    // Requisito: US03 - "Visualizar contagem por status" -> contagem por status apresentada (L1)
    // Técnica: Partição de Equivalência (2 EM_ANALISE, 1 APROVADA, 1 REPROVADA da ana + 1 do bruno)
    // Esperado: { EM_ANALISE: 2, APROVADA: 1, REPROVADA: 1 }, status sem iniciativa = 0 (ausente),
    //           e a contagem é pedida para a ana (não conta a iniciativa do bruno)
    // OBS: o critério não define "ausente x zero" para status sem iniciativas; por isso a
    //      asserção de EM_ANDAMENTO usa `?? 0`. A contagem real é GROUP BY no SQL (ver cabeçalho).
    const ctx = montarPainel();
    ctx.leitura.semear(
      umaIniciativa().comId('a1').doAutor('ana').emAnalise().construir(),
      umaIniciativa().comId('a2').doAutor('ana').emAnalise().construir(),
      umaIniciativa().comId('a3').doAutor('ana').aprovada().construir(),
      umaIniciativa().comId('a4').doAutor('ana').reprovada().construir(),
      umaIniciativa().comId('b1').doAutor('bruno').emAnalise().construir(),
    );
    const contagem = vi.spyOn(ctx.leitura, 'contagemPorStatus');

    const resultado = await ctx.consultas.minhas('ana', { page: 1, limit: 20 });

    expect(resultado.contagemPorStatus).toMatchObject({ EM_ANALISE: 2, APROVADA: 1, REPROVADA: 1 });
    expect(resultado.contagemPorStatus.EM_ANDAMENTO ?? 0).toBe(0);
    expect(contagem).toHaveBeenCalledWith('ana');
  });

  it('US03 após avaliação, painel com status atualizado | Partição de Equivalência (antes x depois da decisão) | status passa de EM_ANALISE para APROVADA', async () => {
    // Requisito: US03 - "Após avaliação, painel apresenta status atualizado" (L1)
    // Técnica: Partição de Equivalência (estado antes x estado depois da avaliação)
    // Esperado: antes: EM_ANALISE; após `decidir` do comitê: APROVADA com decididaEm = instante da decisão
    const ctx = montarPainel();
    ctx.leitura.semear(
      umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir(),
    );

    const antes = await ctx.consultas.listar({ page: 1, limit: 20 });
    expect(antes.items.map((i) => [i.id, i.status, i.decididaEm])).toEqual([
      ['i1', 'EM_ANALISE', null],
    ]);

    await ctx.decidir.executar('i1', 'carla', 'APROVADA', undefined);

    const depois = await ctx.consultas.listar({ page: 1, limit: 20 });
    expect(depois.items.map((i) => [i.id, i.status, i.decididaEm])).toEqual([
      ['i1', 'APROVADA', T0.toISOString()],
    ]);
  });

  it('US03 após avaliação, painel com status atualizado | Partição de Equivalência (resultado REPROVADA) | status passa de EM_ANALISE para REPROVADA', async () => {
    // Requisito: US03 - "Após avaliação, painel apresenta status atualizado" (L1)
    // Técnica: Partição de Equivalência (resultado = REPROVADA, com justificativa)
    // Esperado: após `decidir` REPROVADA, o painel mostra REPROVADA
    const ctx = montarPainel();
    ctx.leitura.semear(
      umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir(),
    );

    await ctx.decidir.executar('i1', 'carla', 'REPROVADA', 'Sem espaço disponível.');

    const { items } = await ctx.consultas.listar({ page: 1, limit: 20 });
    expect(items.map((i) => [i.id, i.status])).toEqual([['i1', 'REPROVADA']]);
  });
});
