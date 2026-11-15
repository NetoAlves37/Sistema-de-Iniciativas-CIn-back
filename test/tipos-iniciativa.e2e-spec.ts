import { createTestApp, type TestApp } from './support/create-app';

/**
 * E2E do cadastro de tipos de iniciativa: aplicação real, Postgres real. Os testes só mexem em
 * tipos que eles mesmos criam (nomes com sufixo aleatório), para não afetar `EXTENSAO`,
 * `PESQUISA` e `EVENTO`, que as outras suítes usam.
 */
describe('E2E: cadastro de tipos de iniciativa', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const sufixo = () => crypto.randomUUID().slice(0, 6).toUpperCase();

  async function cadastrar(nome: string, cor = '#336699') {
    const resposta = await (await t.req('admin')).post('/tipos-iniciativa').send({ nome, cor });
    expect(resposta.status).toBe(201);
    return resposta.body.data as { id: number; code: string; nome: string };
  }

  const logDe = (tipoCode: string) =>
    t.prisma.tipoIniciativaLog.findMany({
      where: { tipoCode },
      include: { acao: true },
      orderBy: { seq: 'asc' },
    });

  it('qualquer autenticado lista; sem token recebe 401', async () => {
    expect((await (await t.req()).get('/tipos-iniciativa')).status).toBe(401);
    const resposta = await (await t.req('diego')).get('/tipos-iniciativa?ativos=true');
    expect(resposta.status).toBe(200);
    expect(resposta.body.data.map((tipo: { code: string }) => tipo.code)).toEqual(
      expect.arrayContaining(['EXTENSAO', 'PESQUISA', 'EVENTO']),
    );
  });

  it('aluno não cadastra, não altera e não exclui (403)', async () => {
    const aluno = await t.req('diego');
    expect((await aluno.post('/tipos-iniciativa').send({ nome: 'X', cor: '#000000' })).status).toBe(
      403,
    );
    expect((await aluno.patch('/tipos-iniciativa/1').send({ nome: 'X' })).status).toBe(403);
    expect((await aluno.delete('/tipos-iniciativa/1')).status).toBe(403);
  });

  it('o comitê cadastra, renomeia, troca a cor, desativa e exclui; tudo vai para o log', async () => {
    const nome = `Palestra ${sufixo()}`;
    const criado = await cadastrar(nome);
    expect(criado.code).toMatch(/^PALESTRA_/);

    const comite = await t.req('carla');
    const renomeado = await comite
      .patch(`/tipos-iniciativa/${criado.id}`)
      .send({ nome: `${nome} Magna`, cor: '#aa0000' });
    expect(renomeado.status).toBe(200);
    expect(renomeado.body.data).toMatchObject({ code: criado.code, cor: '#AA0000' });

    const desativado = await comite.patch(`/tipos-iniciativa/${criado.id}`).send({ ativo: false });
    expect(desativado.body.data.ativo).toBe(false);
    const ativos = await comite.get('/tipos-iniciativa?ativos=true');
    expect(ativos.body.data.map((tipo: { id: number }) => tipo.id)).not.toContain(criado.id);

    expect((await comite.delete(`/tipos-iniciativa/${criado.id}`)).status).toBe(204);

    const log = await logDe(criado.code);
    expect(log.map((linha) => linha.acao.code)).toEqual([
      'CRIADO',
      'ALTERADO',
      'DESATIVADO',
      'EXCLUIDO',
    ]);
    expect(log[0]).toMatchObject({ por: expect.any(String), porNome: expect.any(String) });
    expect(log[1]).toMatchObject({
      antes: { nome, cor: '#336699' },
      depois: { nome: `${nome} Magna`, cor: '#AA0000' },
    });
    expect(log[3].tipoId).toBeNull();
    expect(log[3].ocorreuEm).toBeInstanceOf(Date);
  });

  it('um tipo novo pode ser usado numa iniciativa e, com ela, não pode ser excluído (409)', async () => {
    const tipo = await cadastrar(`Liga ${sufixo()}`);
    const submissao = await (await t.req('ana')).post('/iniciativas').send({
      tipo: tipo.code,
      titulo: `Iniciativa ${sufixo()}`,
      resumo: 'Encontros semanais da liga.',
      detalhe: 'Estudo e competição.',
      inicio: '2026-12-01',
      fim: '2026-12-01',
      periodicidade: 'EVENTO_UNICO',
      espaco: 'Sala A',
      organizadores: 'Ana',
      participantes: 10,
    });
    expect(submissao.status).toBe(201);
    expect(submissao.body.data.tipo).toBe(tipo.code);

    const exclusao = await (await t.req('admin')).delete(`/tipos-iniciativa/${tipo.id}`);
    expect(exclusao.status).toBe(409);
    expect(exclusao.body.detail).toBe(
      'Este tipo não pode ser excluído porque há 1 iniciativa associada a ele. Você pode desativá-lo.',
    );

    const lista = await (await t.req('admin')).get('/tipos-iniciativa');
    const dela = lista.body.data.find((item: { id: number }) => item.id === tipo.id);
    expect(dela.iniciativas).toBe(1);
  });

  it('tipo desativado não pode ser escolhido numa submissão nova (422 no campo tipo)', async () => {
    const tipo = await cadastrar(`Festival ${sufixo()}`);
    await (await t.req('admin')).patch(`/tipos-iniciativa/${tipo.id}`).send({ ativo: false });

    const resposta = await (await t.req('ana')).post('/iniciativas').send({
      tipo: tipo.code,
      titulo: 'Festival',
      resumo: 'Resumo',
      detalhe: 'Detalhe',
      inicio: '2026-12-01',
      fim: '2026-12-01',
      periodicidade: 'EVENTO_UNICO',
      espaco: 'Pátio',
      organizadores: 'Ana',
      participantes: 100,
    });
    expect(resposta.status).toBe(422);
    expect(resposta.body.errors).toHaveProperty('tipo');
  });

  it('nome repetido recebe 422 e tipo inexistente 404', async () => {
    const nome = `Oficina ${sufixo()}`;
    await cadastrar(nome);
    const repetido = await (await t.req('admin'))
      .post('/tipos-iniciativa')
      .send({ nome: nome.toLowerCase(), cor: '#000000' });
    expect(repetido.status).toBe(422);
    expect(repetido.body.errors).toHaveProperty('nome');

    const inexistente = await (await t.req('admin')).patch('/tipos-iniciativa/999999').send({
      nome: 'X',
    });
    expect(inexistente.status).toBe(404);
  });
});
