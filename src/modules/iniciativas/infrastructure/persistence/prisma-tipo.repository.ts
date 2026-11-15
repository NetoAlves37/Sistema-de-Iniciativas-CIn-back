import { Injectable } from '@nestjs/common';
import { type TipoIniciativa as LinhaTipo, Prisma } from '@prisma/client';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import { TipoEmUsoError } from '../../domain/errors/iniciativas.errors';
import type { AutorRegistro, TipoRepository } from '../../domain/ports/tipo.repository';
import { type RegistroTipo, TipoDeIniciativa } from '../../domain/tipo-de-iniciativa';

const paraDominio = (linha: LinhaTipo): TipoDeIniciativa =>
  TipoDeIniciativa.reconstituir({
    id: linha.id,
    code: linha.code,
    nome: linha.label,
    cor: linha.cor,
    ativo: linha.ativo,
  });

const json = (valor: object | null) =>
  valor === null ? Prisma.DbNull : (valor as Prisma.InputJsonObject);

@Injectable()
export class PrismaTipoRepository implements TipoRepository {
  /** Lookup das ações do log (code → id), pequeno e imutável: carregado uma vez. */
  private acaoIds?: Map<string, number>;

  constructor(private readonly host: PrismaTransactionHost) {}

  async buscarPorId(id: number): Promise<TipoDeIniciativa | null> {
    const linha = await this.host.client.tipoIniciativa.findUnique({ where: { id } });
    return linha ? paraDominio(linha) : null;
  }

  async listar(): Promise<TipoDeIniciativa[]> {
    const linhas = await this.host.client.tipoIniciativa.findMany({
      orderBy: [{ label: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(paraDominio);
  }

  async codigosAtivos(): Promise<string[]> {
    const linhas = await this.host.client.tipoIniciativa.findMany({
      where: { ativo: true },
      select: { code: true },
    });
    return linhas.map((linha) => linha.code);
  }

  async contarIniciativas(): Promise<Map<number, number>> {
    const grupos = await this.host.client.iniciativa.groupBy({
      by: ['tipoId'],
      _count: { _all: true },
    });
    return new Map(grupos.map((grupo) => [grupo.tipoId, grupo._count._all]));
  }

  async criar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<number> {
    const linha = await this.host.client.tipoIniciativa.create({
      data: { code: tipo.code, label: tipo.nome, cor: tipo.cor, ativo: tipo.ativo },
    });
    await this.gravarLog(linha.id, tipo, tipo.pullRegistros(), autor, agora);
    return linha.id;
  }

  async salvar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<void> {
    const registros = tipo.pullRegistros();
    if (registros.length === 0) return;
    await this.host.client.tipoIniciativa.update({
      where: { id: tipo.id },
      data: { label: tipo.nome, cor: tipo.cor, ativo: tipo.ativo },
    });
    await this.gravarLog(tipo.id, tipo, registros, autor, agora);
  }

  async excluir(
    tipo: TipoDeIniciativa,
    registro: RegistroTipo,
    autor: AutorRegistro,
    agora: Date,
  ): Promise<void> {
    // O log é gravado antes, ainda com o `tipoId`; a FK `SET NULL` o desliga na exclusão.
    await this.gravarLog(tipo.id, tipo, [registro], autor, agora);
    try {
      await this.host.client.tipoIniciativa.delete({ where: { id: tipo.id } });
    } catch (erro) {
      // P2003: a FK de `iniciativas.tipo_id` barrou (alguém usou o tipo nesse meio-tempo).
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw new TipoEmUsoError();
      }
      throw erro;
    }
  }

  private async gravarLog(
    tipoId: number,
    tipo: TipoDeIniciativa,
    registros: RegistroTipo[],
    autor: AutorRegistro,
    agora: Date,
  ): Promise<void> {
    if (registros.length === 0) return;
    const acoes = await this.acoes();
    await this.host.client.tipoIniciativaLog.createMany({
      data: registros.map((registro) => ({
        tipoId,
        tipoCode: tipo.code,
        tipoLabel: tipo.nome,
        acaoId: acoes.get(registro.acao) as number,
        por: autor.id,
        porNome: autor.nome,
        antes: json(registro.antes),
        depois: json(registro.depois),
        ocorreuEm: agora,
      })),
    });
  }

  private async acoes(): Promise<Map<string, number>> {
    if (!this.acaoIds) {
      const linhas = await this.host.client.acaoTipoIniciativa.findMany();
      this.acaoIds = new Map(linhas.map((linha) => [linha.code, linha.id]));
    }
    return this.acaoIds;
  }
}
