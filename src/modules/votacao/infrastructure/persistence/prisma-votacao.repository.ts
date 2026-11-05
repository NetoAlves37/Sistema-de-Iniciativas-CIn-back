import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import type {
  ParIniciativaCiclo,
  Placar,
  VotacaoRepository,
} from '../../domain/ports/votacao.repository';
import type { MeuVoto, ValorVoto } from '../../domain/voto';

@Injectable()
export class PrismaVotacaoRepository implements VotacaoRepository {
  constructor(private readonly host: PrismaTransactionHost) {}

  async garantirPlacar(iniciativaId: string, ciclo: number): Promise<void> {
    await this.host.client.$executeRaw`
      INSERT INTO votacao_placar (iniciativa_id, ciclo, likes, dislikes, relevancia)
      VALUES (${iniciativaId}::uuid, ${ciclo}, 0, 0, 0)
      ON CONFLICT (iniciativa_id, ciclo) DO NOTHING`;
  }

  async travarPlacar(iniciativaId: string, ciclo: number): Promise<void> {
    await this.host.client.$queryRaw`
      SELECT iniciativa_id FROM votacao_placar
      WHERE iniciativa_id = ${iniciativaId}::uuid AND ciclo = ${ciclo}
      FOR UPDATE`;
  }

  async buscarVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<MeuVoto> {
    const voto = await this.host.client.voto.findUnique({
      where: { iniciativaId_ciclo_usuarioId: { iniciativaId, ciclo, usuarioId } },
    });
    return voto?.valor === 1 ? 1 : voto?.valor === -1 ? -1 : 0;
  }

  async gravarVoto(
    iniciativaId: string,
    ciclo: number,
    usuarioId: string,
    valor: ValorVoto,
  ): Promise<void> {
    await this.host.client.voto.upsert({
      where: { iniciativaId_ciclo_usuarioId: { iniciativaId, ciclo, usuarioId } },
      create: { iniciativaId, ciclo, usuarioId, valor },
      update: { valor },
    });
  }

  async removerVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<void> {
    await this.host.client.voto.deleteMany({ where: { iniciativaId, ciclo, usuarioId } });
  }

  async contarVotos(
    iniciativaId: string,
    ciclo: number,
  ): Promise<{ likes: number; dislikes: number }> {
    const client = this.host.client;
    const [likes, dislikes] = await Promise.all([
      client.voto.count({ where: { iniciativaId, ciclo, valor: 1 } }),
      client.voto.count({ where: { iniciativaId, ciclo, valor: -1 } }),
    ]);
    return { likes, dislikes };
  }

  async salvarPlacar(iniciativaId: string, ciclo: number, placar: Placar): Promise<void> {
    await this.host.client.placar.update({
      where: { iniciativaId_ciclo: { iniciativaId, ciclo } },
      data: { likes: placar.likes, dislikes: placar.dislikes, relevancia: placar.relevancia },
    });
  }

  async buscarPlacar(iniciativaId: string, ciclo: number): Promise<Placar | null> {
    const linha = await this.host.client.placar.findUnique({
      where: { iniciativaId_ciclo: { iniciativaId, ciclo } },
    });
    return linha
      ? { likes: linha.likes, dislikes: linha.dislikes, relevancia: linha.relevancia }
      : null;
  }

  async buscarPlacares(pares: ParIniciativaCiclo[]): Promise<Map<string, Placar>> {
    const resultado = new Map<string, Placar>();
    if (pares.length === 0) return resultado;
    const linhas = await this.host.client.placar.findMany({
      where: { OR: pares.map((p) => ({ iniciativaId: p.iniciativaId, ciclo: p.ciclo })) },
    });
    for (const linha of linhas) {
      resultado.set(linha.iniciativaId, {
        likes: linha.likes,
        dislikes: linha.dislikes,
        relevancia: linha.relevancia,
      });
    }
    return resultado;
  }
}
