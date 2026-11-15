import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/database/prisma.service';
import { CLOCK } from '../../src/shared/shared.tokens';
import { FakeClock } from '../../src/shared/testing/fake-clock';
import { tokenDe } from '../../src/shared/testing/tokens';
import { type NomeUsuarioTeste } from '../../src/shared/testing/usuarios-teste';

export interface TestApp {
  app: INestApplication;
  clock: FakeClock;
  prisma: PrismaService;
  /** Prefixo + versão, por exemplo `/sistema-de-iniciativas-cin/api/v1`. */
  api: string;
  /** Requisição HTTP autenticada como o usuário de teste (ou anônima, sem argumento). */
  req: (usuario?: NomeUsuarioTeste) => Promise<AuthedRequest>;
  http: ReturnType<typeof supertest>;
  close(): Promise<void>;
}

/**
 * Os tipos de iniciativa são um cadastro e um banco novo começa vazio. Os testes submetem
 * com `EXTENSAO`, `PESQUISA` e `EVENTO`, então eles são garantidos (e reativados) aqui.
 */
export const TIPOS_DE_TESTE = [
  { code: 'EXTENSAO', label: 'Extensão', cor: '#9BE0A0' },
  { code: 'PESQUISA', label: 'Pesquisa', cor: '#A7C7F2' },
  { code: 'EVENTO', label: 'Evento', cor: '#F7AE85' },
] as const;

async function garantirTiposDeTeste(prisma: PrismaService): Promise<void> {
  for (const tipo of TIPOS_DE_TESTE) {
    await prisma.tipoIniciativa.upsert({
      where: { code: tipo.code },
      update: { label: tipo.label, cor: tipo.cor, ativo: true },
      create: tipo,
    });
  }
}

export interface AuthedRequest {
  get(path: string): supertest.Test;
  post(path: string): supertest.Test;
  put(path: string): supertest.Test;
  patch(path: string): supertest.Test;
  delete(path: string): supertest.Test;
}

/**
 * Sobe a aplicação real (mesma configuração do `main.ts`) com `AUTH_MODE=test` e um
 * `FakeClock` no lugar do relógio, para os testes controlarem o tempo.
 */
export async function createTestApp(inicio?: Date): Promise<TestApp> {
  const clock = new FakeClock(inicio ?? new Date('2026-11-02T12:00:00.000Z'));

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prefix = app.get(ConfigService).get<string>('API_PREFIX', 'api');
  const api = `/${prefix}/v1`;
  const http = supertest(app.getHttpServer());

  const req = async (usuario?: NomeUsuarioTeste): Promise<AuthedRequest> => {
    const token = usuario ? await tokenDe(usuario) : undefined;
    const com = (t: supertest.Test) => (token ? t.set('Authorization', `Bearer ${token}`) : t);
    return {
      get: (p) => com(http.get(`${api}${p}`)),
      post: (p) => com(http.post(`${api}${p}`)),
      put: (p) => com(http.put(`${api}${p}`)),
      patch: (p) => com(http.patch(`${api}${p}`)),
      delete: (p) => com(http.delete(`${api}${p}`)),
    };
  };

  const prisma = app.get(PrismaService);
  await garantirTiposDeTeste(prisma);

  return { app, clock, prisma, api, req, http, close: () => app.close() };
}
