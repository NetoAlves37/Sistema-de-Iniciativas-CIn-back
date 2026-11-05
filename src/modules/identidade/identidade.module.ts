import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Clock } from '@/shared/domain/clock';
import { CLOCK } from '@/shared/shared.tokens';
import { IdentidadeFacade } from './application/identidade.facade';
import { PrismaUsuarioRepository } from './infrastructure/persistence/prisma-usuario.repository';
import { MeController } from './presentation/http/me.controller';
import { UsuarioSyncGuard } from './presentation/http/usuario-sync.guard';

@Module({
  controllers: [MeController],
  providers: [
    PrismaUsuarioRepository,
    {
      provide: IdentidadeFacade,
      useFactory: (usuarios: PrismaUsuarioRepository, clock: Clock) =>
        new IdentidadeFacade(usuarios, clock),
      inject: [PrismaUsuarioRepository, CLOCK],
    },
    // Deve ser registrado depois do AuthModule (ordem de import no AppModule).
    { provide: APP_GUARD, useClass: UsuarioSyncGuard },
  ],
  exports: [IdentidadeFacade],
})
export class IdentidadeModule {}
