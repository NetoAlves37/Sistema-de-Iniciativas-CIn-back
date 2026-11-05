import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import supertest from 'supertest';
import { configureApp } from '@/app.setup';
import { AuthModule } from '@/common/auth/auth.module';
import corsConfig from '@/config/cors.config';
import databaseConfig from '@/config/database.config';
import { validateEnv } from '@/config/env.validation';
import keycloakConfig from '@/config/keycloak.config';
import prazosConfig from '@/config/prazos.config';
import swaggerConfig from '@/config/swagger.config';
import { PrismaModule } from '@/database/prisma.module';
import { PrismaService } from '@/database/prisma.service';
import { IdentidadeModule } from '@/modules/identidade/identidade.module';
import {
  type EstadoIniciativaDto,
  IniciativasFacade,
} from '@/modules/iniciativas/application/iniciativas.facade';
import { IniciativasModule } from '@/modules/iniciativas/iniciativas.module';
import { VotacaoFacade } from '@/modules/votacao/application/votacao.facade';
import { wilson } from '@/modules/votacao/domain/relevancia';
import { VotacaoModule } from '@/modules/votacao/votacao.module';
import { SharedModule } from '@/shared/shared.module';
import { tokenDe } from '@/shared/testing/tokens';
import { USUARIOS_TESTE } from '@/shared/testing/usuarios-teste';

/** Dublê de `IniciativasFacade`: só `obterEstado`, que é o que a votação consome. */
class IniciativasDuble {
  readonly estados = new Map<string, EstadoIniciativaDto>();
  async obterEstado(id: string): Promise<EstadoIniciativaDto | null> {
    return this.estados.get(id) ?? null;
  }
}

describe('votacao (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let votacao: VotacaoFacade;
  let http: ReturnType<typeof supertest>;
  const iniciativas = new IniciativasDuble();
  const criadas: string[] = [];
  const prefixo = `/${process.env.API_PREFIX}/v1`;

  const novaIniciativa = (extra: Partial<EstadoIniciativaDto> = {}): EstadoIniciativaDto => {
    const estado: EstadoIniciativaDto = {
      id: randomUUID(),
      autorId: USUARIOS_TESTE.ana.id,
      status: 'EM_VOTACAO',
      ciclo: 1,
      comVotacao: true,
      fimRefinamento: null,
      fimVotacao: null,
      ...extra,
    };
    iniciativas.estados.set(estado.id, estado);
    criadas.push(estado.id);
    return estado;
  };

  const linhasDeVotos = (iniciativaId: string, ciclo = 1) =>
    prisma.voto.findMany({ where: { iniciativaId, ciclo } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: validateEnv,
          load: [databaseConfig, swaggerConfig, keycloakConfig, prazosConfig, corsConfig],
        }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        SharedModule,
        AuthModule,
        IdentidadeModule,
        IniciativasModule,
        VotacaoModule,
      ],
      providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
    })
      .overrideProvider(IniciativasFacade)
      .useValue(iniciativas)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    votacao = app.get(VotacaoFacade);
    http = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.voto.deleteMany({ where: { iniciativaId: { in: criadas } } });
    await prisma.placar.deleteMany({ where: { iniciativaId: { in: criadas } } });
    await app.close();
  });

  describe('RN-07: registrar, trocar e retirar', () => {
    it('RN-07.1/07.2/07.3: o ciclo registrar, alterar e retirar persiste votos e placar', async () => {
      const { id } = novaIniciativa();
      const diego = USUARIOS_TESTE.diego.id;

      const registrado = await votacao.votar({ iniciativaId: id, usuarioId: diego, valor: 1 });
      expect(registrado).toMatchObject({ meuVoto: 1, likes: 1, dislikes: 0, acao: 'REGISTRADO' });
      expect(registrado.relevancia).toBe(wilson(1, 1));
      expect(await votacao.meuVoto(id, 1, diego)).toBe(1);

      const alterado = await votacao.votar({ iniciativaId: id, usuarioId: diego, valor: -1 });
      expect(alterado).toMatchObject({ meuVoto: -1, likes: 0, dislikes: 1, acao: 'ALTERADO' });
      expect((await linhasDeVotos(id)).map((v) => v.valor)).toEqual([-1]);

      const retirado = await votacao.votar({ iniciativaId: id, usuarioId: diego, valor: -1 });
      expect(retirado).toEqual({
        meuVoto: 0,
        likes: 0,
        dislikes: 0,
        relevancia: 0,
        acao: 'RETIRADO',
      });
      expect(await linhasDeVotos(id)).toHaveLength(0);
      expect(await votacao.placar(id, 1)).toEqual({ likes: 0, dislikes: 0, relevancia: 0 });
    });

    it('RN-07.4: o autor vota', async () => {
      const { id } = novaIniciativa();
      const resultado = await votacao.votar({
        iniciativaId: id,
        usuarioId: USUARIOS_TESTE.ana.id,
        valor: 1,
      });
      expect(resultado).toMatchObject({ meuVoto: 1, likes: 1 });
    });

    it('RN-07.7: o voto de um ciclo não aparece no seguinte, e o placar é por ciclo', async () => {
      const estado = novaIniciativa();
      const diego = USUARIOS_TESTE.diego.id;
      await votacao.votar({ iniciativaId: estado.id, usuarioId: diego, valor: 1 });

      iniciativas.estados.set(estado.id, { ...estado, ciclo: 2 });
      expect(await votacao.meuVoto(estado.id, 2, diego)).toBe(0);
      expect(await votacao.placar(estado.id, 2)).toEqual({ likes: 0, dislikes: 0, relevancia: 0 });

      const resultado = await votacao.votar({
        iniciativaId: estado.id,
        usuarioId: diego,
        valor: -1,
      });
      expect(resultado).toMatchObject({ meuVoto: -1, likes: 0, dislikes: 1, acao: 'REGISTRADO' });
      expect(await votacao.placar(estado.id, 1)).toMatchObject({ likes: 1, dislikes: 0 });
      expect(await votacao.placar(estado.id, 2)).toMatchObject({ likes: 0, dislikes: 1 });
    });

    it('RN-07.5: fora de Em votação nada é gravado', async () => {
      const { id } = novaIniciativa({ status: 'EM_ANALISE', comVotacao: false });
      await expect(
        votacao.votar({ iniciativaId: id, usuarioId: USUARIOS_TESTE.diego.id, valor: 1 }),
      ).rejects.toMatchObject({ code: 'VOTACAO_ENCERRADA' });
      expect(await linhasDeVotos(id)).toHaveLength(0);
      expect(await prisma.placar.count({ where: { iniciativaId: id } })).toBe(0);
    });

    it('placares em lote devolve só quem tem linha', async () => {
      const a = novaIniciativa();
      const b = novaIniciativa();
      await votacao.votar({ iniciativaId: a.id, usuarioId: USUARIOS_TESTE.diego.id, valor: 1 });
      const mapa = await votacao.placares([
        { iniciativaId: a.id, ciclo: 1 },
        { iniciativaId: b.id, ciclo: 1 },
      ]);
      expect(mapa.get(a.id)).toMatchObject({ likes: 1, dislikes: 0 });
      expect(mapa.has(b.id)).toBe(false);
    });
  });

  describe('concorrência', () => {
    it('RN-07.6: 20 votos concorrentes do mesmo usuário deixam no máximo 1 linha e placar coerente', async () => {
      const { id } = novaIniciativa();
      const usuarioId = USUARIOS_TESTE.diego.id;

      const resultados = await Promise.all(
        Array.from({ length: 20 }, () => votacao.votar({ iniciativaId: id, usuarioId, valor: 1 })),
      );

      const linhas = await linhasDeVotos(id);
      expect(linhas.length).toBeLessThanOrEqual(1);
      // Todas as chamadas foram serializadas: 20 alternâncias (registrar/retirar) => 0 voto.
      expect(linhas).toHaveLength(0);
      const placar = await prisma.placar.findUniqueOrThrow({
        where: { iniciativaId_ciclo: { iniciativaId: id, ciclo: 1 } },
      });
      expect(placar).toMatchObject({ likes: linhas.length, dislikes: 0 });
      expect(placar.relevancia).toBeCloseTo(
        wilson(placar.likes, placar.likes + placar.dislikes),
        12,
      );
      // Cada resposta é coerente com a decisão tomada.
      expect(resultados.filter((r) => r.acao === 'REGISTRADO')).toHaveLength(10);
      expect(resultados.filter((r) => r.acao === 'RETIRADO')).toHaveLength(10);
      expect(await prisma.placar.count({ where: { iniciativaId: id } })).toBe(1);
    });

    it('RN-07.6: 21 votos concorrentes do mesmo usuário deixam exatamente 1 linha', async () => {
      const { id } = novaIniciativa();
      const usuarioId = USUARIOS_TESTE.bruno.id;
      await Promise.all(
        Array.from({ length: 21 }, () => votacao.votar({ iniciativaId: id, usuarioId, valor: -1 })),
      );
      const linhas = await linhasDeVotos(id);
      expect(linhas).toHaveLength(1);
      expect(await votacao.placar(id, 1)).toMatchObject({ likes: 0, dislikes: 1 });
    });

    it('votos concorrentes de usuários diferentes mantêm likes e dislikes corretos', async () => {
      const { id } = novaIniciativa();
      const usuarios = Array.from({ length: 24 }, (_, i) => `usuario-concorrente-${i}`);

      await Promise.all(
        usuarios.map((usuarioId, i) =>
          votacao.votar({ iniciativaId: id, usuarioId, valor: i % 3 === 0 ? -1 : 1 }),
        ),
      );

      const dislikes = usuarios.filter((_, i) => i % 3 === 0).length; // 8
      const likes = usuarios.length - dislikes; // 16
      const placar = await prisma.placar.findUniqueOrThrow({
        where: { iniciativaId_ciclo: { iniciativaId: id, ciclo: 1 } },
      });
      expect(placar).toMatchObject({ likes, dislikes });
      expect(placar.relevancia).toBeCloseTo(wilson(likes, likes + dislikes), 12);
      expect(await linhasDeVotos(id)).toHaveLength(usuarios.length);
    });

    it('trocas concorrentes de vários usuários deixam o placar igual à contagem de votos', async () => {
      const { id } = novaIniciativa();
      const usuarios = Array.from({ length: 10 }, (_, i) => `usuario-troca-${i}`);
      await Promise.all(
        usuarios.map((u) => votacao.votar({ iniciativaId: id, usuarioId: u, valor: 1 })),
      );
      await Promise.all(
        usuarios.map((u) => votacao.votar({ iniciativaId: id, usuarioId: u, valor: -1 })),
      );

      const placar = await votacao.placar(id, 1);
      expect(placar).toMatchObject({ likes: 0, dislikes: 10 });
      expect(placar.relevancia).toBeCloseTo(wilson(0, 10), 12);
    });
  });

  describe('HTTP: PUT /iniciativas/:id/voto', () => {
    const put = async (id: string, usuario: 'ana' | 'diego', corpo: unknown) =>
      http
        .put(`${prefixo}/iniciativas/${id}/voto`)
        .set('Authorization', `Bearer ${await tokenDe(usuario)}`)
        .send(corpo as object);

    it('200 com o resultado dentro do envelope', async () => {
      const { id } = novaIniciativa();
      const resposta = await put(id, 'diego', { valor: 1 });
      expect(resposta.status).toBe(200);
      expect(resposta.body.data).toMatchObject({
        meuVoto: 1,
        likes: 1,
        dislikes: 0,
        acao: 'REGISTRADO',
      });
      expect(resposta.body.data.relevancia).toBeCloseTo(wilson(1, 1), 12);
      expect(resposta.body.statusCode).toBe(200);

      const retirado = await put(id, 'diego', { valor: 1 });
      expect(retirado.body.data).toMatchObject({ meuVoto: 0, acao: 'RETIRADO' });
    });

    it('401 sem token', async () => {
      const { id } = novaIniciativa();
      const resposta = await http.put(`${prefixo}/iniciativas/${id}/voto`).send({ valor: 1 });
      expect(resposta.status).toBe(401);
    });

    it.each([
      ['404 (iniciativa inexistente)', () => randomUUID(), { valor: 1 }, 404],
      [
        '409 (fora de Em votação)',
        () => novaIniciativa({ status: 'EM_ANDAMENTO' }).id,
        { valor: 1 },
        409,
      ],
      ['422 (valor 0)', () => novaIniciativa().id, { valor: 0 }, 422],
      ['422 (valor ausente)', () => novaIniciativa().id, {}, 422],
      ['422 (valor texto)', () => novaIniciativa().id, { valor: 'like' }, 422],
    ])('%s', async (_nome, idDe, corpo, status) => {
      const resposta = await put(idDe(), 'ana', corpo);
      expect(resposta.status).toBe(status);
      expect(resposta.headers['content-type']).toContain('application/problem+json');
    });

    it('409 traz a mensagem do PROMPT', async () => {
      const { id } = novaIniciativa({ status: 'EM_ANALISE' });
      const resposta = await put(id, 'ana', { valor: -1 });
      expect(resposta.body.detail).toBe('A votação desta iniciativa foi encerrada.');
    });

    it('400 se o id não é um UUID', async () => {
      const resposta = await put('nao-e-uuid', 'ana', { valor: 1 });
      expect(resposta.status).toBe(400);
    });
  });
});
