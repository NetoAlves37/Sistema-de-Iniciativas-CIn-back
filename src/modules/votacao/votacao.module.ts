import { forwardRef, Module } from '@nestjs/common';
import { IniciativasModule } from '@/modules/iniciativas/iniciativas.module';
import type { IniciativaPort } from './application/ports/iniciativa.port';
import type { TransacaoPort } from './application/ports/transacao.port';
import { VotacaoFacade } from './application/votacao.facade';
import type { VotacaoRepository } from './domain/ports/votacao.repository';
import { IniciativaAdapter } from './infrastructure/adapters/iniciativa.adapter';
import { TransacaoAdapter } from './infrastructure/adapters/transacao.adapter';
import { PrismaVotacaoRepository } from './infrastructure/persistence/prisma-votacao.repository';
import { VotoController } from './presentation/http/voto.controller';
import { INICIATIVA_PORT, TRANSACAO_PORT, VOTACAO_REPOSITORY } from './votacao.tokens';

@Module({
  imports: [forwardRef(() => IniciativasModule)],
  controllers: [VotoController],
  providers: [
    { provide: VOTACAO_REPOSITORY, useClass: PrismaVotacaoRepository },
    { provide: INICIATIVA_PORT, useClass: IniciativaAdapter },
    { provide: TRANSACAO_PORT, useClass: TransacaoAdapter },
    {
      provide: VotacaoFacade,
      useFactory: (
        votacao: VotacaoRepository,
        iniciativas: IniciativaPort,
        transacao: TransacaoPort,
      ) => new VotacaoFacade(votacao, iniciativas, transacao),
      inject: [VOTACAO_REPOSITORY, INICIATIVA_PORT, TRANSACAO_PORT],
    },
  ],
  exports: [VotacaoFacade],
})
export class VotacaoModule {}
