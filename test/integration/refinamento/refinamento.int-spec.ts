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
import { RefinamentoFacade } from '@/modules/refinamento/application/refinamento.facade';
import { RefinamentoModule } from '@/modules/refinamento/refinamento.module';
import { SharedModule } from '@/shared/shared.module';
import { tokenDe } from '@/shared/testing/tokens';
import { USUARIOS_TESTE } from '@/shared/testing/usuarios-teste';

/** Dublê de `IniciativasFacade`: só `obterEstado`, que é o que o refinamento consome. */
class IniciativasDuble {
  readonly estados = new Map<string, EstadoIniciativaDto>();
  async obterEstado(id: string): Promise<EstadoIniciativaDto | null> {
    return this.estados.get(id) ?? null;
  }
}

describe('refinamento (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let refinamento: RefinamentoFacade;
  let http: ReturnType<typeof supertest>;
  const iniciativas = new IniciativasDuble();
  const criadas: string[] = [];
  const prefixo = `/${process.env.API_PREFIX}/v1`;

  const novaIniciativa = (extra: Partial<EstadoIniciativaDto> = {}): EstadoIniciativaDto => {
    const estado: EstadoIniciativaDto = {
      id: randomUUID(),
      autorId: USUARIOS_TESTE.ana.id,
      status: 'EM_ANDAMENTO',
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

  /** Insere direto (para controlar `criadoEm`), como se tivesse sido criado em outro momento. */
  const inserir = (iniciativaId: string, ciclo: number, texto: string, criadoEm: string) =>
    prisma.comentario.create({
      data: {
        iniciativaId,
        ciclo,
        texto,
        autorId: USUARIOS_TESTE.bruno.id,
        criadoEm: new Date(criadoEm),
      },
    });

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
        RefinamentoModule,
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
    refinamento = app.get(RefinamentoFacade);
    http = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.comentario.deleteMany({ where: { iniciativaId: { in: criadas } } });
    await app.close();
  });

  describe('repositório', () => {
    it('RN-05.1: comenta, persiste o ciclo e devolve o autor vindo de identidade', async () => {
      const { id } = novaIniciativa({ ciclo: 2 });
      // Garante o usuário em `identidade` (o guard faz isso a cada requisição autenticada).
      await http
        .get(`${prefixo}/iniciativas/${id}/comentarios`)
        .set('Authorization', `Bearer ${await tokenDe('bruno')}`);

      const dto = await refinamento.comentar({
        iniciativaId: id,
        autorId: USUARIOS_TESTE.bruno.id,
        texto: '  Que tal no turno da tarde?  ',
      });
      expect(dto).toMatchObject({
        ciclo: 2,
        texto: 'Que tal no turno da tarde?',
        autor: {
          id: USUARIOS_TESTE.bruno.id,
          nome: USUARIOS_TESTE.bruno.nome,
          perfil: 'PROFESSOR',
          ehAutorDaIniciativa: false,
        },
      });
      const linha = await prisma.comentario.findUniqueOrThrow({ where: { id: dto.id } });
      expect(linha).toMatchObject({ iniciativaId: id, ciclo: 2, texto: dto.texto });
    });

    it('RN-05.4: lista o ciclo mais recente primeiro e, dentro dele, do mais antigo para o mais novo', async () => {
      const { id } = novaIniciativa({ ciclo: 2 });
      await inserir(id, 1, 'c1-b', '2026-11-03T10:00:00Z');
      await inserir(id, 2, 'c2-b', '2026-11-12T10:00:00Z');
      await inserir(id, 1, 'c1-a', '2026-11-02T10:00:00Z');
      await inserir(id, 2, 'c2-a', '2026-11-11T10:00:00Z');

      const pagina = await refinamento.listar({ iniciativaId: id });
      expect(pagina.items.map((i) => [i.ciclo, i.texto])).toEqual([
        [2, 'c2-a'],
        [2, 'c2-b'],
        [1, 'c1-a'],
        [1, 'c1-b'],
      ]);
      expect(pagina.meta).toEqual({ page: 1, limit: 50, total: 4, totalPages: 1 });
    });

    it('pagina com page e limit sem repetir nem pular itens', async () => {
      const { id } = novaIniciativa();
      for (let i = 0; i < 5; i++) {
        await inserir(id, 1, `item-${i}`, `2026-11-02T10:0${i}:00Z`);
      }
      const p1 = await refinamento.listar({ iniciativaId: id, page: 1, limit: 2 });
      const p2 = await refinamento.listar({ iniciativaId: id, page: 2, limit: 2 });
      const p3 = await refinamento.listar({ iniciativaId: id, page: 3, limit: 2 });
      expect([...p1.items, ...p2.items, ...p3.items].map((i) => i.texto)).toEqual([
        'item-0',
        'item-1',
        'item-2',
        'item-3',
        'item-4',
      ]);
      expect(p3.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
    });

    it('contarSugestoes conta só o ciclo pedido, em lote; ausente = 0', async () => {
      const a = novaIniciativa({ ciclo: 2 });
      const b = novaIniciativa();
      const vazia = novaIniciativa();
      await inserir(a.id, 1, 'antigo', '2026-11-02T10:00:00Z');
      await inserir(a.id, 2, 'novo-1', '2026-11-12T10:00:00Z');
      await inserir(a.id, 2, 'novo-2', '2026-11-12T11:00:00Z');
      await inserir(b.id, 1, 'b-1', '2026-11-02T10:00:00Z');

      const contagens = await refinamento.contarSugestoes([
        { iniciativaId: a.id, ciclo: 2 },
        { iniciativaId: b.id, ciclo: 1 },
        { iniciativaId: vazia.id, ciclo: 1 },
      ]);
      expect(contagens.get(a.id)).toBe(2);
      expect(contagens.get(b.id)).toBe(1);
      expect(contagens.get(vazia.id) ?? 0).toBe(0);
      expect((await refinamento.contarSugestoes([])).size).toBe(0);
    });
  });

  describe('HTTP', () => {
    const post = async (id: string, usuario: 'ana' | 'bruno', corpo: unknown) =>
      http
        .post(`${prefixo}/iniciativas/${id}/comentarios`)
        .set('Authorization', `Bearer ${await tokenDe(usuario)}`)
        .send(corpo as object);
    const get = async (id: string, query = '') =>
      http
        .get(`${prefixo}/iniciativas/${id}/comentarios${query}`)
        .set('Authorization', `Bearer ${await tokenDe('bruno')}`);

    it('RN-05.1: POST devolve 201 com o comentário no envelope, e o GET o lista', async () => {
      const { id } = novaIniciativa();
      const criado = await post(id, 'bruno', { texto: 'Sugiro reservar o auditório.' });
      expect(criado.status).toBe(201);
      expect(criado.body.data).toMatchObject({
        ciclo: 1,
        texto: 'Sugiro reservar o auditório.',
        autor: {
          id: USUARIOS_TESTE.bruno.id,
          nome: 'Bruno Lima',
          perfil: 'PROFESSOR',
          ehAutorDaIniciativa: false,
        },
      });
      expect(new Date(criado.body.data.criadoEm).toISOString()).toBe(criado.body.data.criadoEm);

      const lista = await get(id);
      expect(lista.status).toBe(200);
      expect(lista.body.data.items).toHaveLength(1);
      expect(lista.body.data.items[0].id).toBe(criado.body.data.id);
      expect(lista.body.data.meta).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
    });

    it('RN-05.1: o autor da iniciativa comenta e aparece como ehAutorDaIniciativa', async () => {
      const { id } = novaIniciativa();
      const criado = await post(id, 'ana', { texto: 'Obrigada pelas ideias!' });
      expect(criado.status).toBe(201);
      expect(criado.body.data.autor.ehAutorDaIniciativa).toBe(true);
    });

    it.each([
      ['RN-05.2: texto vazio', { texto: '   ' }],
      ['RN-05.2: texto acima de 1000 caracteres', { texto: 'a'.repeat(1001) }],
      ['texto ausente', {}],
      ['texto que não é string', { texto: 42 }],
    ])('422: %s', async (_nome, corpo) => {
      const { id } = novaIniciativa();
      const resposta = await post(id, 'bruno', corpo);
      expect(resposta.status).toBe(422);
      expect(resposta.headers['content-type']).toContain('application/problem+json');
      expect(resposta.body.errors).toHaveProperty('texto');
    });

    it('RN-05.2: a mensagem do texto vazio é a do PROMPT', async () => {
      const { id } = novaIniciativa();
      const resposta = await post(id, 'bruno', { texto: '' });
      expect(resposta.body.errors.texto).toContain('Escreva sua sugestão antes de enviar.');
    });

    it.each([
      'EM_VOTACAO',
      'EM_ANALISE',
      'APROVADA',
      'REPROVADA',
    ])('RN-05.3/05.5: 409 em %s', async (status) => {
      const { id } = novaIniciativa({ status: status as EstadoIniciativaDto['status'] });
      const resposta = await post(id, 'bruno', { texto: 'tarde demais' });
      expect(resposta.status).toBe(409);
      expect(resposta.body.detail).toBe('A fase de sugestões terminou.');
      expect(await prisma.comentario.count({ where: { iniciativaId: id } })).toBe(0);
    });

    it('404 se a iniciativa não existe (POST e GET)', async () => {
      const inexistente = randomUUID();
      expect((await post(inexistente, 'bruno', { texto: 'oi' })).status).toBe(404);
      expect((await get(inexistente)).status).toBe(404);
    });

    it('400 se o id não é um UUID', async () => {
      expect((await post('nao-e-uuid', 'bruno', { texto: 'oi' })).status).toBe(400);
      expect((await get('nao-e-uuid')).status).toBe(400);
    });

    it('401 sem token', async () => {
      const { id } = novaIniciativa();
      expect((await http.get(`${prefixo}/iniciativas/${id}/comentarios`)).status).toBe(401);
      expect(
        (await http.post(`${prefixo}/iniciativas/${id}/comentarios`).send({ texto: 'oi' })).status,
      ).toBe(401);
    });

    it('GET respeita page e limit; limit inválido é 422', async () => {
      const { id } = novaIniciativa();
      for (let i = 0; i < 3; i++) await inserir(id, 1, `h-${i}`, `2026-11-02T10:0${i}:00Z`);
      const pagina = await get(id, '?page=2&limit=2');
      expect(pagina.status).toBe(200);
      expect(pagina.body.data.items.map((i: { texto: string }) => i.texto)).toEqual(['h-2']);
      expect(pagina.body.data.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect((await get(id, '?limit=0')).status).toBe(422);
    });

    it('RN-05.4: comentários do ciclo anterior continuam listados com o ciclo', async () => {
      const { id } = novaIniciativa({ ciclo: 2 });
      await inserir(id, 1, 'do ciclo 1', '2026-11-02T10:00:00Z');
      const criado = await post(id, 'bruno', { texto: 'do ciclo 2' });
      expect(criado.body.data.ciclo).toBe(2);
      const lista = await get(id);
      expect(lista.body.data.items.map((i: { ciclo: number }) => i.ciclo)).toEqual([2, 1]);
    });
  });
});
