import {
  type INestApplication,
  ValidationPipe as NestValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new NestValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('should return an array of tasks', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/tasks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
});
