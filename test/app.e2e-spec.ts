import { tokenAvulso, tokenDe } from '../src/shared/testing/tokens';
import { USUARIOS_TESTE } from '../src/shared/testing/usuarios-teste';
import { createTestApp, type TestApp } from './support/create-app';

/**
 * E2E da fundação: aplicação real (mesmo prefixo, versionamento, pipe, filtro e envelope
 * do `main.ts`), Postgres real e `TestIdentitySource` (AUTH_MODE=test). Os fluxos de
 * negócio têm os próprios arquivos de e2e.
 */
describe('App (e2e): fundação', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('GET /health', () => {
    it('é público, sem versionamento, e confere a conexão com o banco', async () => {
      const response = await t.http.get('/sistema-de-iniciativas-cin/api/health');
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.info.database.status).toBe('up');
    });
  });

  describe('autenticação (RNF-03)', () => {
    it('401 sem token, no formato Problem Details', async () => {
      const response = await (await t.req()).get('/me');
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ status: 401, code: 'ACCESS_DENIED' });
    });

    it('401 com token inválido ou expirado', async () => {
      const invalido = await t.http.get(`${t.api}/me`).set('Authorization', 'Bearer nao.e.jwt');
      expect(invalido.status).toBe(401);
      const expirado = await tokenDe('ana', { expiraEm: '-10m' });
      const resposta = await t.http.get(`${t.api}/me`).set('Authorization', `Bearer ${expirado}`);
      expect(resposta.status).toBe(401);
    });

    it('401 com token assinado por outro segredo', async () => {
      const forjado = await tokenDe('ana', { secret: 'outro-segredo-qualquer-que-nao-confere' });
      const resposta = await t.http.get(`${t.api}/me`).set('Authorization', `Bearer ${forjado}`);
      expect(resposta.status).toBe(401);
    });

    it('403 para usuário sem nenhuma role do sistema', async () => {
      const token = await tokenAvulso(crypto.randomUUID(), ['offline_access']);
      const resposta = await t.http.get(`${t.api}/me`).set('Authorization', `Bearer ${token}`);
      expect(resposta.status).toBe(403);
      expect(resposta.body.code).toBe('ACCESS_DENIED');
    });
  });

  describe('GET /me (HU-01a)', () => {
    it('devolve id, nome, perfil, ehComite e prazos no envelope, sem e-mail nem roles (RNF-01)', async () => {
      const response = await (await t.req('ana')).get('/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        statusCode: 200,
        path: `${t.api}/me`,
        data: {
          id: USUARIOS_TESTE.ana.id,
          nome: 'Ana Souza',
          perfil: 'ALUNO',
          ehComite: false,
          prazos: { refinamentoDias: 3, votacaoDias: 3 },
        },
      });
      expect(typeof response.body.timestamp).toBe('string');
      expect(Object.keys(response.body.data).sort()).toEqual([
        'ehComite',
        'id',
        'nome',
        'perfil',
        'prazos',
      ]);
    });

    it.each([
      ['ana', 'ALUNO', false],
      ['bruno', 'PROFESSOR', false],
      ['carla', 'COMITE', true],
      ['diego', 'ALUNO', false],
      ['elisa', 'COMITE', true],
      ['admin', 'ADMIN', true],
    ] as const)('%s tem o perfil %s (ehComite=%s)', async (usuario, perfil, ehComite) => {
      const response = await (await t.req(usuario)).get('/me');
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ perfil, ehComite });
    });

    it('cria o usuário na primeira requisição e atualiza nome e perfil quando mudam', async () => {
      const sub = crypto.randomUUID();
      const primeiro = await tokenAvulso(sub, ['sys_sistema-de-iniciativas-cin-users'], {
        nome: 'Bruno Lima',
        perfil: 'aluno',
      });
      await t.http.get(`${t.api}/me`).set('Authorization', `Bearer ${primeiro}`);
      let usuario = await t.prisma.usuario.findUnique({
        where: { id: sub },
        include: { perfil: true },
      });
      expect(usuario).toMatchObject({ nome: 'Bruno Lima', perfil: { code: 'ALUNO' } });

      const segundo = await tokenAvulso(sub, ['sys_sistema-de-iniciativas-cin-users'], {
        nome: 'Prof. Bruno Lima',
        perfil: 'professor',
      });
      const resposta = await t.http.get(`${t.api}/me`).set('Authorization', `Bearer ${segundo}`);
      expect(resposta.body.data).toMatchObject({ nome: 'Prof. Bruno Lima', perfil: 'PROFESSOR' });
      usuario = await t.prisma.usuario.findUnique({
        where: { id: sub },
        include: { perfil: true },
      });
      expect(usuario).toMatchObject({ nome: 'Prof. Bruno Lima', perfil: { code: 'PROFESSOR' } });
    });

    it('não persiste e-mail nem contato do usuário (RNF-01)', async () => {
      const colunas = await t.prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'identidade_usuarios'`;
      expect(colunas.map((c) => c.column_name).sort()).toEqual([
        'atualizado_em',
        'id',
        'nome',
        'perfil_id',
      ]);
    });
  });

  describe('CORS', () => {
    it('aceita a origem do front configurada, com credenciais, e não ecoa outras', async () => {
      const permitida = await t.http
        .options(`${t.api}/me`)
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(permitida.headers['access-control-allow-credentials']).toBe('true');

      const negada = await t.http
        .options(`${t.api}/me`)
        .set('Origin', 'http://malicioso.example')
        .set('Access-Control-Request-Method', 'GET');
      expect(negada.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Problem Details', () => {
    it('uma rota que não existe devolve 404 em Problem Details', async () => {
      const response = await (await t.req('ana')).get('/nao-existe');
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });
});
