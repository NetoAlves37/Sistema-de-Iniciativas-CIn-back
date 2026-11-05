import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import type { Comentario } from '../../domain/comentario';
import type {
  ComentarioPersistido,
  ComentarioRepository,
  PaginaDeComentarios,
  ParIniciativaCiclo,
} from '../../domain/ports/comentario.repository';

@Injectable()
export class PrismaComentarioRepository implements ComentarioRepository {
  constructor(private readonly host: PrismaTransactionHost) {}

  async salvar(comentario: Comentario): Promise<ComentarioPersistido> {
    return this.host.client.comentario.create({
      data: {
        iniciativaId: comentario.iniciativaId,
        ciclo: comentario.ciclo,
        autorId: comentario.autorId,
        texto: comentario.texto,
        criadoEm: comentario.criadoEm,
      },
    });
  }

  async listarPorIniciativa(
    iniciativaId: string,
    skip: number,
    take: number,
  ): Promise<PaginaDeComentarios> {
    const client = this.host.client;
    const [items, total] = await Promise.all([
      client.comentario.findMany({
        where: { iniciativaId },
        orderBy: [{ ciclo: 'desc' }, { criadoEm: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      client.comentario.count({ where: { iniciativaId } }),
    ]);
    return { items, total };
  }

  async contarPorCiclo(pares: ParIniciativaCiclo[]): Promise<Map<string, number>> {
    const contagens = new Map<string, number>();
    if (pares.length === 0) return contagens;
    const grupos = await this.host.client.comentario.groupBy({
      by: ['iniciativaId', 'ciclo'],
      where: { OR: pares.map((p) => ({ iniciativaId: p.iniciativaId, ciclo: p.ciclo })) },
      _count: { _all: true },
    });
    for (const grupo of grupos) {
      const atual = contagens.get(grupo.iniciativaId) ?? 0;
      contagens.set(grupo.iniciativaId, atual + grupo._count._all);
    }
    return contagens;
  }
}
