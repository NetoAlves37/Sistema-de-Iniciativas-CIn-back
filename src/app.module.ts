import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './common/auth/auth.module';
import corsConfig from './config/cors.config';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import keycloakConfig from './config/keycloak.config';
import prazosConfig from './config/prazos.config';
import swaggerConfig from './config/swagger.config';
import { PrismaModule } from './database/prisma.module';
import { AvaliacaoModule } from './modules/avaliacao/avaliacao.module';
import { DivulgacaoModule } from './modules/divulgacao/divulgacao.module';
import { HealthModule } from './modules/health/health.module';
import { IdentidadeModule } from './modules/identidade/identidade.module';
import { IniciativasModule } from './modules/iniciativas/iniciativas.module';
import { RefinamentoModule } from './modules/refinamento/refinamento.module';
import { VotacaoModule } from './modules/votacao/votacao.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [databaseConfig, swaggerConfig, keycloakConfig, prazosConfig, corsConfig],
    }),
    // Infraestrutura transversal: eventos de domínio, agendador (job de prazos), relógio,
    // host de transação e publicador de eventos.
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    SharedModule,
    // A ordem importa: os guards globais rodam na ordem em que os módulos são importados
    // (AuthGuard, RolesGuard, e só então a sincronização do usuário em IdentidadeModule).
    AuthModule,
    HealthModule,
    IdentidadeModule,
    IniciativasModule,
    RefinamentoModule,
    VotacaoModule,
    AvaliacaoModule,
    DivulgacaoModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
