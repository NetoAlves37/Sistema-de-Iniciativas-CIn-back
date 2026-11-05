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
import { AvaliacaoModule } from '@/modules/avaliacao/avaliacao.module';
import type {
  DetalheIniciativaDto,
  FiltroListagemDto,
  RegistrarDecisaoInput,
  ResumoIniciativaDto,
} from '@/modules/iniciativas/application/iniciativas.facade';
import { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import { DomainError } from '@/shared/domain/domain-error';
import { SharedModule } from '@/shared/shared.module';
import { tokenDe } from '@/shared/testing/tokens';
import { type NomeUsuarioTeste, USUARIOS_TESTE } from '@/shared/testing/usuarios-teste';

const resumo = (id: string, autorId: string, relevancia: number): ResumoIniciativaDto => ({
  id,
  tipo: 'EVENTO',
  titulo: `Iniciativa ${id}`,
  resumo: 'Resumo',
  autor: { id: autorId, nome: 'Autor', perfil: 'PROFESSOR' },
  status: 'EM_ANALISE',
  comVotacao: relevancia > 0,
  ciclo: 1,
  fimRefinamento: null,
  fimVotacao: null,
  prazoAtual: null,
  votos: { likes: 0, dislikes: 0, relevancia },
  sugestoesCicloAtual: 0,
  inicio: '2026-11-10',
  fim: '2026-11-10',
  periodicidade: 'EVENTO_UNICO',
  espaco: 'Sala 1',
  criadaEm: '2026-10-01T12:00:00.000Z',
  decididaEm: null,
});

class ProibidoErro extends DomainError {
  readonly code = 'PROIBIDO';
  readonly tipo = 'proibido' as const;
}
class ConflitoErro extends DomainError {
  readonly code = 'CONFLITO';
  readonly tipo = 'conflito' as const;
}
class NaoEncontradoErro extends DomainError {
  readonly code = 'NAO_ENCONTRADO';
  readonly tipo = 'nao_encontrado' as const;
}

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_PROPRIA = '33333333-3333-4333-8333-333333333333';
const ID_DECIDIDA = '44444444-4444-4444-8444-444444444444';
const ID_INEXISTENTE = '55555555-5555-4555-8555-555555555555';

class FachadaDuble {
  listagens: FiltroListagemDto[] = [];
  decisoes: RegistrarDecisaoInput[] = [];
  atores: Array<{ id: string; nome: string; ehComite: boolean }> = [];
  fila = [
    resumo(ID_A, USUARIOS_TESTE.bruno.id, 0.9),
    resumo(ID_PROPRIA, USUARIOS_TESTE.carla.id, 0.4),
    resumo(ID_B, USUARIOS_TESTE.diego.id, 0),
  ];

  async listar(filtro: FiltroListagemDto) {
    this.listagens.push(filtro);
    return { items: this.fila, total: 3 };
  }

  async registrarDecisao(input: RegistrarDecisaoInput) {
    if (input.iniciativaId === ID_PROPRIA) {
      throw new ProibidoErro(
        'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
      );
    }
    if (input.iniciativaId === ID_DECIDIDA) {
      throw new ConflitoErro('Esta iniciativa já foi decidida.');
    }
    if (input.iniciativaId === ID_INEXISTENTE) {
      throw new NaoEncontradoErro('Iniciativa não encontrada.');
    }
    this.decisoes.push(input);
  }

  async detalhe(
    id: string,
    ator: { id: string; nome: string; ehComite: boolean },
  ): Promise<DetalheIniciativaDto> {
    this.atores.push(ator);
    const decisao = this.decisoes.find((d) => d.iniciativaId === id);
    return {
      ...resumo(id, USUARIOS_TESTE.bruno.id, 0),
      status: decisao?.resultado ?? 'EM_ANALISE',
      detalhe: 'Detalhe',
      horaInicio: null,
      horaFim: null,
      organizadores: 'Org',
      membros: null,
      participantes: 10,
      meuVoto: 0,
      permissoes: {
        podeEditar: false,
        podeComentar: false,
        podeVotar: false,
        podeDecidir: false,
        podeRessubmeter: false,
      },
      decisao: decisao
        ? {
            resultado: decisao.resultado,
            justificativa: decisao.justificativa ?? null,
            decisor: { nome: ator.nome },
            decididaEm: '2026-11-02T12:00:00.000Z',
          }
        : null,
      ultimaJustificativa: null,
      googleAgendaUrl: null,
    };
  }
}

describe('Avaliação (HTTP)', () => {
  let app: INestApplication;
  let fachada: FachadaDuble;
  let http: ReturnType<typeof supertest>;
  let api: string;

  beforeAll(async () => {
    fachada = new FachadaDuble();
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
        AvaliacaoModule,
      ],
      providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
    })
      .overrideProvider(IniciativasFacade)
      .useValue(fachada)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    api = `/${process.env.API_PREFIX}/v1/avaliacao`;
    http = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fachada.listagens = [];
    fachada.decisoes = [];
    fachada.atores = [];
  });

  const como = async (usuario: NomeUsuarioTeste) => ({
    Authorization: `Bearer ${await tokenDe(usuario)}`,
  });

  describe('GET /avaliacao/fila', () => {
    it('RN-09.1: aluno recebe 403', async () => {
      const resposta = await http.get(`${api}/fila`).set(await como('ana'));
      expect(resposta.status).toBe(403);
      expect(fachada.listagens).toEqual([]);
    });

    it('sem token recebe 401', async () => {
      const resposta = await http.get(`${api}/fila`);
      expect(resposta.status).toBe(401);
    });

    it('RN-09.2: comitê vê a fila de Em análise por relevância, paginada', async () => {
      const resposta = await http.get(`${api}/fila?page=1&limit=10`).set(await como('elisa'));
      expect(resposta.status).toBe(200);
      expect(fachada.listagens).toEqual([
        { status: 'EM_ANALISE', ordenar: 'relevancia', page: 1, limit: 10 },
      ]);
      const { data } = resposta.body;
      expect(data.items.map((i: { id: string }) => i.id)).toEqual([ID_A, ID_PROPRIA, ID_B]);
      expect(data.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
      expect(data.items[2].votos.relevancia).toBe(0);
      expect(resposta.body).toMatchObject({ statusCode: 200, path: expect.any(String) });
    });

    it('RN-09.3: souAutor é true só nas iniciativas do usuário logado', async () => {
      const resposta = await http.get(`${api}/fila`).set(await como('carla'));
      expect(resposta.status).toBe(200);
      expect(
        resposta.body.data.items.map((i: { id: string; souAutor: boolean }) => [i.id, i.souAutor]),
      ).toEqual([
        [ID_A, false],
        [ID_PROPRIA, true],
        [ID_B, false],
      ]);
    });

    it('admin também acessa a fila', async () => {
      const resposta = await http.get(`${api}/fila`).set(await como('admin'));
      expect(resposta.status).toBe(200);
    });

    it('paginação inválida recebe 422', async () => {
      const resposta = await http.get(`${api}/fila?page=0`).set(await como('carla'));
      expect(resposta.status).toBe(422);
    });
  });

  describe('POST /avaliacao/:id/decisao', () => {
    const decidir = async (usuario: NomeUsuarioTeste, id: string, corpo: object) =>
      http
        .post(`${api}/${id}/decisao`)
        .set(await como(usuario))
        .send(corpo);

    it('aluno recebe 403', async () => {
      const resposta = await decidir('ana', ID_A, { resultado: 'APROVADA' });
      expect(resposta.status).toBe(403);
      expect(fachada.decisoes).toEqual([]);
    });

    it('RN-10.1: aprova e devolve o detalhe atualizado', async () => {
      const resposta = await decidir('carla', ID_A, { resultado: 'APROVADA', justificativa: 'x' });
      expect(resposta.status).toBe(200);
      expect(resposta.body.data).toMatchObject({
        id: ID_A,
        status: 'APROVADA',
        decisao: { resultado: 'APROVADA', justificativa: null },
      });
      expect(fachada.decisoes).toEqual([
        {
          iniciativaId: ID_A,
          resultado: 'APROVADA',
          justificativa: null,
          decisorId: USUARIOS_TESTE.carla.id,
        },
      ]);
      expect(fachada.atores).toEqual([
        { id: USUARIOS_TESTE.carla.id, nome: 'Carla Menezes', ehComite: true },
      ]);
    });

    it('RN-10.2: reprova com justificativa', async () => {
      const resposta = await decidir('elisa', ID_A, {
        resultado: 'REPROVADA',
        justificativa: ' Fora do escopo. ',
      });
      expect(resposta.status).toBe(200);
      expect(resposta.body.data.decisao).toMatchObject({
        resultado: 'REPROVADA',
        justificativa: 'Fora do escopo.',
      });
    });

    it('admin decide com as mesmas regras do comitê', async () => {
      const resposta = await decidir('admin', ID_A, { resultado: 'APROVADA' });
      expect(resposta.status).toBe(200);
      expect(fachada.decisoes[0].decisorId).toBe(USUARIOS_TESTE.admin.id);
    });

    it('RN-10.3: reprovar sem justificativa recebe 422 com o campo', async () => {
      const resposta = await decidir('carla', ID_A, {
        resultado: 'REPROVADA',
        justificativa: '  ',
      });
      expect(resposta.status).toBe(422);
      expect(resposta.body.errors).toMatchObject({
        justificativa: ['A justificativa é obrigatória para reprovar.'],
      });
      expect(fachada.decisoes).toEqual([]);
    });

    it('resultado inválido recebe 422', async () => {
      const resposta = await decidir('carla', ID_A, { resultado: 'TALVEZ' });
      expect(resposta.status).toBe(422);
    });

    it('id que não é UUID recebe 400', async () => {
      const resposta = await decidir('carla', 'abc', { resultado: 'APROVADA' });
      expect(resposta.status).toBe(400);
    });

    it('RN-10.4: o autor recebe 403 com a mensagem da regra', async () => {
      const resposta = await decidir('carla', ID_PROPRIA, { resultado: 'APROVADA' });
      expect(resposta.status).toBe(403);
      expect(JSON.stringify(resposta.body)).toContain(
        'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
      );
    });

    it('RN-10.5: iniciativa já decidida ou fora de Em análise recebe 409', async () => {
      const resposta = await decidir('carla', ID_DECIDIDA, { resultado: 'APROVADA' });
      expect(resposta.status).toBe(409);
      expect(JSON.stringify(resposta.body)).toContain('Esta iniciativa já foi decidida.');
    });

    it('iniciativa inexistente recebe 404', async () => {
      const resposta = await decidir('carla', ID_INEXISTENTE, { resultado: 'APROVADA' });
      expect(resposta.status).toBe(404);
    });
  });
});
