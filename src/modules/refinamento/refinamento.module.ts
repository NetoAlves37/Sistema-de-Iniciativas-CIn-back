import { forwardRef, Module } from '@nestjs/common';
import { IdentidadeModule } from '@/modules/identidade/identidade.module';
import { IniciativasModule } from '@/modules/iniciativas/iniciativas.module';
import type { Clock } from '@/shared/domain/clock';
import { CLOCK } from '@/shared/shared.tokens';
import type { AutoresPort } from './application/ports/autores.port';
import type { IniciativaPort } from './application/ports/iniciativa.port';
import { RefinamentoFacade } from './application/refinamento.facade';
import type { ComentarioRepository } from './domain/ports/comentario.repository';
import { AutoresAdapter } from './infrastructure/adapters/autores.adapter';
import { IniciativaAdapter } from './infrastructure/adapters/iniciativa.adapter';
import { PrismaComentarioRepository } from './infrastructure/persistence/prisma-comentario.repository';
import { ComentariosController } from './presentation/http/comentarios.controller';
import { AUTORES_PORT, COMENTARIO_REPOSITORY, INICIATIVA_PORT } from './refinamento.tokens';

@Module({
  imports: [forwardRef(() => IniciativasModule), IdentidadeModule],
  controllers: [ComentariosController],
  providers: [
    { provide: COMENTARIO_REPOSITORY, useClass: PrismaComentarioRepository },
    { provide: INICIATIVA_PORT, useClass: IniciativaAdapter },
    { provide: AUTORES_PORT, useClass: AutoresAdapter },
    {
      provide: RefinamentoFacade,
      useFactory: (
        comentarios: ComentarioRepository,
        iniciativas: IniciativaPort,
        autores: AutoresPort,
        clock: Clock,
      ) => new RefinamentoFacade(comentarios, iniciativas, autores, clock),
      inject: [COMENTARIO_REPOSITORY, INICIATIVA_PORT, AUTORES_PORT, CLOCK],
    },
  ],
  exports: [RefinamentoFacade],
})
export class RefinamentoModule {}
