import { TipoEmUsoError } from '../../../src/modules/iniciativas/domain/errors/iniciativas.errors';
import type { TipoRepository } from '../../../src/modules/iniciativas/domain/ports/tipo.repository';
import { TipoDeIniciativa } from '../../../src/modules/iniciativas/domain/tipo-de-iniciativa';
import { TIPO_REPOSITORY } from '../../../src/modules/iniciativas/iniciativas.tokens';
import { PrismaTransactionHost } from '../../../src/shared/infrastructure/prisma-transaction-host';
import { createTestApp, type TestApp } from '../../support/create-app';

/**
 * Integração do cadastro de tipos com Postgres real: o repositório Prisma, o log de
 * auditoria (lookup de ações, JSON de antes/depois, `tipo_id` que vira NULL na exclusão),
 * a FK que barra excluir tipo em uso e o rollback do log quando a exclusão falha.
 */
describe('Integração: tipos de iniciativa', () => {
  let t: TestApp;
  let repositorio: TipoRepository;
  let host: PrismaTransactionHost;

  const autor = { id: 'admin-int', nome: 'Admin da Integração' };
  const agora = new Date('2026-11-15T13:00:00.000Z');
  const nomeUnico = (base: string) => `${base} ${crypto.randomUUID().slice(0, 6)}`;

  beforeAll(async () => {
    t = await createTestApp();
    repositorio = t.app.get<TipoRepository>(TIPO_REPOSITORY);
    host = t.app.get(PrismaTransactionHost);
  });

  afterAll(async () => {
    await t.close();
  });

  async function criarTipo(nome = nomeUnico('Palestra'), cor = '#336699') {
    const codigos = new Set((await repositorio.listar()).map((tipo) => tipo.code));
    const tipo = TipoDeIniciativa.criar({ nome, cor }, codigos);
    const id = await host.run(() => repositorio.criar(tipo, autor, agora));
    return { id, code: tipo.code, nome: tipo.nome };
  }

  const logDe = (tipoCode: string) =>
    t.prisma.tipoIniciativaLog.findMany({
      where: { tipoCode },
      include: { acao: true },
      orderBy: { seq: 'asc' },
    });

  it('a migration cria o lookup das ações do log', async () => {
    const acoes = await t.prisma.acaoTipoIniciativa.findMany({ orderBy: { id: 'asc' } });
    expect(acoes.map((acao) => acao.code)).toEqual([
      'CRIADO',
      'ALTERADO',
      'ATIVADO',
      'DESATIVADO',
      'EXCLUIDO',
    ]);
  });

  it('criar grava a linha e o log CRIADO com autor, data e o JSON de depois', async () => {
    const criado = await criarTipo();

    const linha = await t.prisma.tipoIniciativa.findUniqueOrThrow({ where: { id: criado.id } });
    expect(linha).toMatchObject({
      code: criado.code,
      label: criado.nome,
      cor: '#336699',
      ativo: true,
    });

    const log = await logDe(criado.code);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      tipoId: criado.id,
      tipoLabel: criado.nome,
      por: 'admin-int',
      porNome: 'Admin da Integração',
      ocorreuEm: agora,
      antes: null,
      depois: { nome: criado.nome, cor: '#336699', ativo: true },
    });
    expect(log[0].acao.code).toBe('CRIADO');
  });

  it('salvar grava as mudanças e um registro por ação; sem mudança, nada é gravado', async () => {
    const criado = await criarTipo();
    const tipo = (await repositorio.buscarPorId(criado.id)) as TipoDeIniciativa;
    tipo.alterar({ nome: `${criado.nome} Magna`, cor: '#AA0000' });
    tipo.definirAtivo(false);
    await host.run(() => repositorio.salvar(tipo, autor, agora));

    const linha = await t.prisma.tipoIniciativa.findUniqueOrThrow({ where: { id: criado.id } });
    expect(linha).toMatchObject({ label: `${criado.nome} Magna`, cor: '#AA0000', ativo: false });

    const recarregado = (await repositorio.buscarPorId(criado.id)) as TipoDeIniciativa;
    await host.run(() => repositorio.salvar(recarregado, autor, agora));

    const log = await logDe(criado.code);
    expect(log.map((linhaLog) => linhaLog.acao.code)).toEqual(['CRIADO', 'ALTERADO', 'DESATIVADO']);
    expect(log[1]).toMatchObject({
      antes: { nome: criado.nome, cor: '#336699' },
      depois: { nome: `${criado.nome} Magna`, cor: '#AA0000' },
    });
  });

  it('codigosAtivos ignora os desativados; listar traz todos em ordem de nome', async () => {
    const ativo = await criarTipo(nomeUnico('Aaa Ativo'));
    const inativo = await criarTipo(nomeUnico('Aaa Inativo'));
    const tipo = (await repositorio.buscarPorId(inativo.id)) as TipoDeIniciativa;
    tipo.definirAtivo(false);
    await host.run(() => repositorio.salvar(tipo, autor, agora));

    const codigos = await repositorio.codigosAtivos();
    expect(codigos).toContain(ativo.code);
    expect(codigos).not.toContain(inativo.code);

    const nomes = (await repositorio.listar()).map((item) => item.nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    expect(nomes).toEqual(expect.arrayContaining([ativo.nome, inativo.nome]));
  });

  it('excluir apaga o tipo, grava EXCLUIDO e o log antigo fica com tipo_id NULL', async () => {
    const criado = await criarTipo();
    const tipo = (await repositorio.buscarPorId(criado.id)) as TipoDeIniciativa;

    await host.run(() => repositorio.excluir(tipo, tipo.registroDeExclusao(), autor, agora));

    expect(await t.prisma.tipoIniciativa.findUnique({ where: { id: criado.id } })).toBeNull();
    const log = await logDe(criado.code);
    expect(log.map((linha) => linha.acao.code)).toEqual(['CRIADO', 'EXCLUIDO']);
    expect(log.every((linha) => linha.tipoId === null)).toBe(true);
    expect(log[1]).toMatchObject({
      tipoLabel: criado.nome,
      antes: { nome: criado.nome, cor: '#336699', ativo: true },
      depois: null,
    });
  });

  it('contarIniciativas conta por tipo; a FK barra a exclusão (409) e o log da tentativa é desfeito', async () => {
    const criado = await criarTipo();
    const resposta = await (await t.req('ana')).post('/iniciativas').send({
      tipo: criado.code,
      titulo: nomeUnico('Iniciativa'),
      resumo: 'Resumo.',
      detalhe: 'Detalhe.',
      inicio: '2026-12-01',
      fim: '2026-12-01',
      periodicidade: 'EVENTO_UNICO',
      espaco: 'Sala',
      organizadores: 'Ana',
      participantes: 5,
    });
    expect(resposta.status).toBe(201);

    expect((await repositorio.contarIniciativas()).get(criado.id)).toBe(1);

    // Simula a corrida: o caso de uso não viu a iniciativa, mas a FK do banco barra.
    const tipo = (await repositorio.buscarPorId(criado.id)) as TipoDeIniciativa;
    await expect(
      host.run(() => repositorio.excluir(tipo, tipo.registroDeExclusao(), autor, agora)),
    ).rejects.toBeInstanceOf(TipoEmUsoError);

    expect(await t.prisma.tipoIniciativa.findUnique({ where: { id: criado.id } })).not.toBeNull();
    expect((await logDe(criado.code)).map((linha) => linha.acao.code)).toEqual(['CRIADO']);
  });

  it('a constraint do banco recusa cor fora de #RRGGBB', async () => {
    await expect(
      t.prisma.tipoIniciativa.create({
        data: { code: `COR_RUIM_${Date.now()}`, label: nomeUnico('Cor ruim'), cor: 'azul' },
      }),
    ).rejects.toThrow();
  });
});
