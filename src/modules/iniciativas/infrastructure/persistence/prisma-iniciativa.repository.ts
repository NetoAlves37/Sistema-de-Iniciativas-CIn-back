import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import { ConcorrenciaError } from '../../domain/errors/iniciativas.errors';
import { Iniciativa, type IniciativaProps } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { StatusIniciativa } from '../../domain/status';
import type { Periodicidade, TipoIniciativa } from '../../domain/tipos';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';

type LinhaIniciativa = Prisma.IniciativaGetPayload<{
  include: { tipo: true; periodicidade: true; status: true };
}>;

const dia = (data: Date): string => data.toISOString().slice(0, 10);

function paraDominio(linha: LinhaIniciativa): Iniciativa {
  const props: IniciativaProps = {
    id: linha.id,
    autorId: linha.autorId,
    dados: DadosIniciativa.criar({
      tipo: linha.tipo.code as TipoIniciativa,
      titulo: linha.titulo,
      resumo: linha.resumo,
      detalhe: linha.detalhe,
      inicio: dia(linha.inicio),
      fim: dia(linha.fim),
      horaInicio: linha.horaInicio,
      horaFim: linha.horaFim,
      periodicidade: linha.periodicidade.code as Periodicidade,
      espaco: linha.espaco,
      organizadores: linha.organizadores,
      membros: linha.membros,
      participantes: linha.participantes,
    }),
    comVotacao: linha.comVotacao,
    status: linha.status.code as StatusIniciativa,
    ciclo: linha.ciclo,
    fimRefinamento: linha.fimRefinamento,
    fimVotacao: linha.fimVotacao,
    justificativa: linha.justificativa,
    decisorId: linha.decisorId,
    decididaEm: linha.decididaEm,
    version: linha.version,
    criadaEm: linha.criadaEm,
  };
  return Iniciativa.reconstituir(props);
}

/** Campos escalares gravados em criação e atualização (as relações entram por `connect`). */
function camposDe(iniciativa: Iniciativa) {
  const { dados } = iniciativa;
  return {
    titulo: dados.titulo,
    resumo: dados.resumo,
    detalhe: dados.detalhe,
    inicio: new Date(dados.inicio),
    fim: new Date(dados.fim),
    horaInicio: dados.horaInicio,
    horaFim: dados.horaFim,
    espaco: dados.espaco,
    organizadores: dados.organizadores,
    membros: dados.membros,
    participantes: dados.participantes,
    comVotacao: iniciativa.comVotacao,
    ciclo: iniciativa.ciclo,
    fimRefinamento: iniciativa.fimRefinamento,
    fimVotacao: iniciativa.fimVotacao,
    justificativa: iniciativa.justificativa,
    decisorId: iniciativa.decisorId,
    decididaEm: iniciativa.decididaEm,
    tipo: { connect: { code: dados.tipo } },
    periodicidade: { connect: { code: dados.periodicidade } },
    status: { connect: { code: iniciativa.status } },
  };
}

@Injectable()
export class PrismaIniciativaRepository implements IniciativaRepository {
  /** Lookup de status (code → id), pequeno e imutável: carregado uma vez. */
  private statusIds?: Map<string, number>;

  constructor(private readonly host: PrismaTransactionHost) {}

  async buscarPorId(id: string): Promise<Iniciativa | null> {
    const linha = await this.host.client.iniciativa.findUnique({
      where: { id },
      include: { tipo: true, periodicidade: true, status: true },
    });
    return linha ? paraDominio(linha) : null;
  }

  async criar(iniciativa: Iniciativa): Promise<void> {
    await this.host.client.iniciativa.create({
      data: {
        id: iniciativa.id,
        autorId: iniciativa.autorId,
        criadaEm: iniciativa.criadaEm,
        version: 0,
        ...camposDe(iniciativa),
      },
    });
    await this.gravarHistorico(iniciativa);
    iniciativa.confirmarGravacao();
  }

  async salvar(iniciativa: Iniciativa): Promise<void> {
    try {
      await this.host.client.iniciativa.update({
        where: { id: iniciativa.id, version: iniciativa.version },
        data: { ...camposDe(iniciativa), version: { increment: 1 } },
      });
    } catch (erro) {
      // P2025: nenhuma linha com esse `id` e `version` (outra gravação chegou antes).
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2025') {
        throw new ConcorrenciaError();
      }
      throw erro;
    }
    await this.gravarHistorico(iniciativa);
    iniciativa.confirmarGravacao();
  }

  async idsComPrazoVencido(agora: Date, limite: number): Promise<string[]> {
    const linhas = await this.host.client.iniciativa.findMany({
      where: {
        OR: [
          { status: { code: 'EM_ANDAMENTO' }, fimRefinamento: { lte: agora } },
          { status: { code: 'EM_VOTACAO' }, fimVotacao: { lte: agora } },
        ],
      },
      select: { id: true },
      orderBy: { criadaEm: 'asc' },
      take: limite,
    });
    return linhas.map((linha) => linha.id);
  }

  private async gravarHistorico(iniciativa: Iniciativa): Promise<void> {
    const transicoes = iniciativa.novasTransicoes();
    if (transicoes.length === 0) return;
    const ids = await this.idsDeStatus();
    await this.host.client.transicaoHistorico.createMany({
      data: transicoes.map((t) => ({
        iniciativaId: iniciativa.id,
        ciclo: t.ciclo,
        deId: t.de ? this.idDe(ids, t.de) : null,
        paraId: this.idDe(ids, t.para),
        por: t.por,
        nota: t.nota,
        justificativa: t.justificativa,
        ocorreuEm: t.ocorreuEm,
      })),
    });
  }

  private idDe(ids: Map<string, number>, code: string): number {
    const id = ids.get(code);
    if (id === undefined) throw new Error(`Status "${code}" não existe em iniciativas_status.`);
    return id;
  }

  private async idsDeStatus(): Promise<Map<string, number>> {
    if (!this.statusIds) {
      const linhas = await this.host.client.statusIniciativa.findMany();
      this.statusIds = new Map(linhas.map((linha) => [linha.code, linha.id]));
    }
    return this.statusIds;
  }
}
