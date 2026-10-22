// Carrega o .env ANTES de importar a aplicação: o job de transições lê TRANSICOES_CRON e
// APP_TIMEZONE na hora em que o módulo é carregado (decorator @Cron).
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa as variáveis do ambiente
}

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  setupSwagger(app);

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
