import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import type {
  FiltroLeitura,
  IniciativaLeituraPort,
  LinhaCalendario,
  LinhaDetalhe,
  LinhaHistorico,
  LinhaResumo,
} from '../../application/ports/iniciativa-leitura.port';
import type { StatusIniciativa } from '../../domain/status';
import type { TipoIniciativa } from '../../domain/tipos';

/**
 * Modelo de leitura das iniciativas, em SQL.
 *
 * EXCEÇÃO DOCUMENTADA À REGRA 5 (ver docs/DECISOES.md, ADR-002): esta consulta junta
 * `votacao_placar` (tabela do módulo `votacao`) para ordenar por relevância com paginação
 * no banco. A relevância (`votacao_placar.relevancia`) é mantida pelo módulo `votacao` na
 * transação do voto; aqui ela só é lida. A ordem do SQL tem de bater com `compararRelevancia`
 * do domínio de `votacao` (teste de integração RN-08.5).
 */
const COLUNAS_RESUMO = Prisma.sql`
  i.id,
  i.autor_id AS "autorId",
  t.code AS tipo,
  i.titulo,
  i.resumo,
  s.code AS status,
  i.com_votacao AS "comVotacao",
  i.ciclo,
  i.fim_refinamento AS "fimRefinamento",
  i.fim_votacao AS "fimVotacao",
  to_char(i.inicio, 'YYYY-MM-DD') AS inicio,
  to_char(i.fim, 'YYYY-MM-DD') AS fim,
  p.code AS periodicidade,
  i.espaco,
  i.criada_em AS "criadaEm",
  i.decidida_em AS "decididaEm",
  COALESCE(pl.likes, 0)::int AS likes,
  COALESCE(pl.dislikes, 0)::int AS dislikes,
  COALESCE(pl.relevancia, 0)::float8 AS relevancia`;

const JUNCOES = Prisma.sql`
  FROM iniciativas i
  JOIN iniciativas_status s ON s.id = i.status_id
  JOIN iniciativas_tipos t ON t.id = i.tipo_id
  JOIN iniciativas_periodicidades p ON p.id = i.periodicidade_id
  LEFT JOIN votacao_placar pl ON pl.iniciativa_id = i.id AND pl.ciclo = i.ciclo`;

function ordenacao(ordenar: FiltroLeitura['ordenar']): Prisma.Sql {
  switch (ordenar) {
    case 'relevancia':
      // RN-08: maior relevância; desempate por mais votos totais, criada há mais tempo e id.
      return Prisma.sql`ORDER BY COALESCE(pl.relevancia, 0) DESC,
        (COALESCE(pl.likes, 0) + COALESCE(pl.dislikes, 0)) DESC, i.criada_em ASC, i.id ASC`;
    case 'prazo':
      return Prisma.sql`ORDER BY (CASE s.code
          WHEN 'EM_ANDAMENTO' THEN i.fim_refinamento
          WHEN 'EM_VOTACAO' THEN i.fim_votacao END) ASC NULLS LAST, i.criada_em ASC, i.id ASC`;
    case 'inicio':
      return Prisma.sql`ORDER BY i.inicio ASC, i.titulo ASC, i.id ASC`;
    default:
      return Prisma.sql`ORDER BY i.criada_em DESC, i.id ASC`;
  }
}

function condicoes(filtro: Pick<FiltroLeitura, 'status' | 'tipo' | 'q' | 'autorId'>): Prisma.Sql {
  const lista: Prisma.Sql[] = [];
  if (filtro.status) lista.push(Prisma.sql`s.code = ${filtro.status}`);
  if (filtro.tipo) lista.push(Prisma.sql`t.code = ${filtro.tipo}`);
  if (filtro.autorId) lista.push(Prisma.sql`i.autor_id = ${filtro.autorId}`);
  if (filtro.q) {
    lista.push(
      Prisma.sql`strpos(lower(i.titulo || ' ' || i.resumo || ' ' || i.organizadores || ' ' || i.espaco), lower(${filtro.q})) > 0`,
    );
  }
  return lista.length > 0 ? Prisma.sql`WHERE ${Prisma.join(lista, ' AND ')}` : Prisma.empty;
}

@Injectable()
export class IniciativaListagemQuery implements IniciativaLeituraPort {
  constructor(private readonly host: PrismaTransactionHost) {}

  async listar(filtro: FiltroLeitura): Promise<{ linhas: LinhaResumo[]; total: number }> {
    const where = condicoes(filtro);
    const offset = (filtro.page - 1) * filtro.limit;
    const [linhas, total] = await Promise.all([
      this.host.client.$queryRaw<LinhaResumo[]>`
        SELECT ${COLUNAS_RESUMO} ${JUNCOES} ${where} ${ordenacao(filtro.ordenar)}
        LIMIT ${filtro.limit} OFFSET ${offset}`,
      this.host.client.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total ${JUNCOES} ${where}`,
    ]);
    return { linhas, total: total[0]?.total ?? 0 };
  }

  async contagemPorStatus(autorId: string): Promise<Partial<Record<StatusIniciativa, number>>> {
    const linhas = await this.host.client.$queryRaw<{ status: StatusIniciativa; total: number }[]>`
      SELECT s.code AS status, count(*)::int AS total
      FROM iniciativas i JOIN iniciativas_status s ON s.id = i.status_id
      WHERE i.autor_id = ${autorId}
      GROUP BY s.code`;
    return Object.fromEntries(linhas.map((linha) => [linha.status, linha.total]));
  }

  async contarPorStatus(status: StatusIniciativa): Promise<number> {
    const linhas = await this.host.client.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM iniciativas i JOIN iniciativas_status s ON s.id = i.status_id
      WHERE s.code = ${status}`;
    return linhas[0]?.total ?? 0;
  }

  async obterLinha(id: string): Promise<LinhaDetalhe | null> {
    const linhas = await this.host.client.$queryRaw<LinhaDetalhe[]>`
      SELECT ${COLUNAS_RESUMO},
        i.detalhe,
        i.hora_inicio AS "horaInicio",
        i.hora_fim AS "horaFim",
        i.organizadores,
        i.membros,
        i.participantes,
        i.decisor_id AS "decisorId",
        i.justificativa
      ${JUNCOES}
      WHERE i.id = ${id}::uuid`;
    return linhas[0] ?? null;
  }

  async historico(id: string): Promise<LinhaHistorico[]> {
    return this.host.client.$queryRaw<LinhaHistorico[]>`
      SELECT h.id, h.ciclo, ds.code AS de, ps.code AS para, h.por, h.nota, h.justificativa,
        h.ocorreu_em AS "ocorreuEm"
      FROM iniciativas_historico h
      LEFT JOIN iniciativas_status ds ON ds.id = h.de_id
      JOIN iniciativas_status ps ON ps.id = h.para_id
      WHERE h.iniciativa_id = ${id}::uuid
      ORDER BY h.ocorreu_em ASC, h.seq ASC`;
  }

  async aprovadasParaCalendario(filtro: {
    de: string;
    ate: string;
    tipos?: TipoIniciativa[];
    autorId?: string;
  }): Promise<LinhaCalendario[]> {
    const extras: Prisma.Sql[] = [];
    if (filtro.tipos && filtro.tipos.length > 0) {
      extras.push(Prisma.sql`AND t.code IN (${Prisma.join(filtro.tipos)})`);
    }
    if (filtro.autorId) extras.push(Prisma.sql`AND i.autor_id = ${filtro.autorId}`);
    return this.host.client.$queryRaw<LinhaCalendario[]>`
      SELECT i.id, i.titulo, t.code AS tipo, i.resumo,
        to_char(i.inicio, 'YYYY-MM-DD') AS inicio,
        to_char(i.fim, 'YYYY-MM-DD') AS fim,
        i.hora_inicio AS "horaInicio", i.hora_fim AS "horaFim",
        p.code AS periodicidade, i.espaco, i.organizadores, i.autor_id AS "autorId"
      FROM iniciativas i
      JOIN iniciativas_status s ON s.id = i.status_id
      JOIN iniciativas_tipos t ON t.id = i.tipo_id
      JOIN iniciativas_periodicidades p ON p.id = i.periodicidade_id
      WHERE s.code = 'APROVADA'
        AND i.inicio < ${filtro.ate}::date AND i.fim >= ${filtro.de}::date
        ${extras.length > 0 ? Prisma.join(extras, ' ') : Prisma.empty}
      ORDER BY i.inicio ASC, i.id ASC`;
  }
}
