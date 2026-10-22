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
import { DivulgacaoModule } from '@/modules/divulgacao/divulgacao.module';
import {
  type AprovadaParaCalendarioDto,
  type FiltroCalendarioInput,
  type FiltroListagemDto,
  IniciativasFacade,
  type ResumoIniciativaDto,
} from '@/modules/iniciativas/application/iniciativas.facade';
import { SharedModule } from '@/shared/shared.module';
import { tokenDe } from '@/shared/testing/tokens';
import { USUARIOS_TESTE } from '@/shared/testing/usuarios-teste';

const resumo = (id: string, titulo: string): ResumoIniciativaDto => ({
  id,
  tipo: 'EXTENSAO',
  titulo,
  resumo: 'Resumo',
  autor: { id: USUARIOS_TESTE.ana.id, nome: 'Ana Souza', perfil: 'ALUNO' },
  status: 'APROVADA',
  comVotacao: true,
  ciclo: 1,
  fimRefinamento: null,
  fimVotacao: null,
  prazoAtual: null,
  votos: { likes: 3, dislikes: 1, relevancia: 0.5 },
  sugestoesCicloAtual: 0,
  inicio: '2026-11-10',
  fim: '2026-12-22',
  periodicidade: 'SEMANAL',
  espaco: 'Sala E122',
  criadaEm: '2026-10-01T12:00:00.000Z',
  decididaEm: null,
});

const semanal: AprovadaParaCalendarioDto = {
  id: '11111111-1111-4111-8111-111111111111',
  titulo: 'Oficina de Python',
  tipo: 'EXTENSAO',
  resumo: 'Resumo da oficina',
  inicio: '2026-11-10',
  fim: '2026-12-22',
  horaInicio: '19:00',
  horaFim: '21:00',
  periodicidade: 'SEMANAL',
  espaco: 'Sala E122',
  organizadores: 'Ana Souza',
  autorId: USUARIOS_TESTE.ana.id,
};

class FachadaDuble {
  listagens: FiltroListagemDto[] = [];
  calendarios: FiltroCalendarioInput[] = [];

  async listar(filtro: FiltroListagemDto) {
    this.listagens.push(filtro);
    return { items: [resumo('i-1', 'Oficina de Python')], total: 41 };
  }

  async aprovadasParaCalendario(filtro: FiltroCalendarioInput) {
    this.calendarios.push(filtro);
    return [semanal];
  }
}

describe('Divulgação (HTTP)', () => {
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
        DivulgacaoModule,
      ],
      providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
    })
      .overrideProvider(IniciativasFacade)
      .useValue(fachada)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    api = `/${process.env.API_PREFIX}/v1/divulgacao`;
    http = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fachada.listagens = [];
    fachada.calendarios = [];
  });

  const comoAna = async () => ({ Authorization: `Bearer ${await tokenDe('ana')}` });

  describe('GET /divulgacao/aprovadas', () => {
    it('exige autenticação', async () => {
      expect((await http.get(`${api}/aprovadas`)).status).toBe(401);
    });

    it('RN-12.5: qualquer autenticado lista; busca e tipo vão para a fachada, ordenados por início', async () => {
      const resposta = await http
        .get(`${api}/aprovadas?q=python&tipo=EXTENSAO&page=2&limit=10`)
        .set(await comoAna());
      expect(resposta.status).toBe(200);
      expect(fachada.listagens).toEqual([
        {
          status: 'APROVADA',
          ordenar: 'inicio',
          q: 'python',
          tipo: 'EXTENSAO',
          page: 2,
          limit: 10,
        },
      ]);
      expect(resposta.body.data.meta).toEqual({ page: 2, limit: 10, total: 41, totalPages: 5 });
      expect(resposta.body.data.items).toHaveLength(1);
      expect(resposta.body.data.items[0]).toMatchObject({ id: 'i-1', status: 'APROVADA' });
    });

    it('sem filtros usa a paginação padrão', async () => {
      const resposta = await http.get(`${api}/aprovadas`).set(await comoAna());
      expect(resposta.status).toBe(200);
      expect(fachada.listagens[0]).toMatchObject({ page: 1, limit: 20 });
      expect(fachada.listagens[0].q).toBeUndefined();
      expect(fachada.listagens[0].tipo).toBeUndefined();
    });

    it('tipo inválido recebe 422', async () => {
      const resposta = await http.get(`${api}/aprovadas?tipo=OUTRO`).set(await comoAna());
      expect(resposta.status).toBe(422);
    });
  });

  describe('GET /divulgacao/ocorrencias', () => {
    it('exige autenticação', async () => {
      expect((await http.get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01`)).status).toBe(401);
    });

    it('RN-12.1: devolve as ocorrências no formato da API, com o link do Google Agenda', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01`)
        .set(await comoAna());
      expect(resposta.status).toBe(200);
      expect(fachada.calendarios).toEqual([
        { de: '2026-11-01', ate: '2026-12-01', tipos: undefined, autorId: undefined },
      ]);
      const itens = resposta.body.data;
      expect(Array.isArray(itens)).toBe(true);
      expect(itens.map((o: { inicio: string }) => o.inicio)).toEqual([
        '2026-11-10T19:00',
        '2026-11-17T19:00',
        '2026-11-24T19:00',
      ]);
      expect(itens[0]).toEqual({
        iniciativaId: semanal.id,
        titulo: 'Oficina de Python',
        tipo: 'EXTENSAO',
        inicio: '2026-11-10T19:00',
        fim: '2026-11-10T21:00',
        diaInteiro: false,
        espaco: 'Sala E122',
        organizadores: 'Ana Souza',
        periodicidade: 'SEMANAL',
        periodoInicio: '2026-11-10',
        periodoFim: '2026-12-22',
        googleAgendaUrl: expect.stringContaining(
          'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Oficina+de+Python&dates=20261110T190000%2F20261110T210000',
        ),
      });
      expect(itens[0].googleAgendaUrl).toContain('RRULE%3AFREQ%3DWEEKLY%3BUNTIL%3D20261222');
    });

    it('RN-12.2: o dia `ate` não entra', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-11-24`)
        .set(await comoAna());
      expect(resposta.body.data.map((o: { inicio: string }) => o.inicio)).toEqual([
        '2026-11-10T19:00',
        '2026-11-17T19:00',
      ]);
    });

    it('RN-12.4: mais de 62 dias recebe 422', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2027-01-03`)
        .set(await comoAna());
      expect(resposta.status).toBe(422);
      expect(resposta.body.errors).toHaveProperty('ate');
      expect(fachada.calendarios).toEqual([]);
    });

    it('RN-12.4: 62 dias exatos é aceito', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2027-01-02`)
        .set(await comoAna());
      expect(resposta.status).toBe(200);
    });

    it('datas ausentes, mal formatadas ou impossíveis recebem 422', async () => {
      const cabecalho = await comoAna();
      expect((await http.get(`${api}/ocorrencias`).set(cabecalho)).status).toBe(422);
      expect(
        (await http.get(`${api}/ocorrencias?de=01/11/2026&ate=2026-12-01`).set(cabecalho)).status,
      ).toBe(422);
      expect(
        (await http.get(`${api}/ocorrencias?de=2026-02-30&ate=2026-03-10`).set(cabecalho)).status,
      ).toBe(422);
      expect(
        (await http.get(`${api}/ocorrencias?de=2026-11-10&ate=2026-11-10`).set(cabecalho)).status,
      ).toBe(422);
    });

    it('`tipos` é CSV e vai para a fachada', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01&tipos=EVENTO,PESQUISA`)
        .set(await comoAna());
      expect(resposta.status).toBe(200);
      expect(fachada.calendarios[0].tipos).toEqual(['EVENTO', 'PESQUISA']);
    });

    it('`tipos` com valor desconhecido recebe 422', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01&tipos=EVENTO,XYZ`)
        .set(await comoAna());
      expect(resposta.status).toBe(422);
    });

    it('RN-12.6: `minhas=true` filtra pelo autor logado', async () => {
      const resposta = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01&minhas=true`)
        .set(await comoAna());
      expect(resposta.status).toBe(200);
      expect(fachada.calendarios[0].autorId).toBe(USUARIOS_TESTE.ana.id);
    });

    it('RN-12.6: `minhas=false` não filtra; valor inválido recebe 422', async () => {
      const cabecalho = await comoAna();
      const sem = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01&minhas=false`)
        .set(cabecalho);
      expect(sem.status).toBe(200);
      expect(fachada.calendarios[0].autorId).toBeUndefined();
      const invalido = await http
        .get(`${api}/ocorrencias?de=2026-11-01&ate=2026-12-01&minhas=talvez`)
        .set(cabecalho);
      expect(invalido.status).toBe(422);
    });
  });
});
