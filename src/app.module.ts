import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './common/auth/auth.module';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import keycloakConfig from './config/keycloak.config';
import swaggerConfig from './config/swagger.config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { TaskModule } from './modules/task/task.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [databaseConfig, swaggerConfig, keycloakConfig],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    TaskModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
