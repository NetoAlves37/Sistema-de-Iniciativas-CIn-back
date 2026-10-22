import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Clock } from '@/shared/domain/clock';
import { CLOCK } from '@/shared/shared.tokens';
import { DivulgacaoModule } from '../divulgacao/divulgacao.module';
import { IdentidadeModule } from '../identidade/identidade.module';
import { RefinamentoModule } from '../refinamento/refinamento.module';
import { VotacaoModule } from '../votacao/votacao.module';
import { IniciativasFacade } from './application/iniciativas.facade';
import type { EventosPort } from './application/ports/eventos.port';
import type { GoogleAgendaPort } from './application/ports/google-agenda.port';
import type { IniciativaLeituraPort } from './application/ports/iniciativa-leitura.port';
import type { SugestoesPort } from './application/ports/sugestoes.port';
import type { TransacaoPort } from './application/ports/transacao.port';
import type { UsuariosPort } from './application/ports/usuarios.port';
import type { VotosPort } from './application/ports/votos.port';
import { ConsultasIniciativas } from './application/queries/consultas-iniciativas';
import { AplicarPrazosVencidos } from './application/use-cases/aplicar-prazos-vencidos';
import { CarregarComPrazos } from './application/use-cases/carregar-com-prazos';
import { ComandosIniciativa } from './application/use-cases/comandos';
import type { IniciativaRepository } from './domain/ports/iniciativa.repository';
import type { PrazosConfig } from './domain/ports/prazos-config';
import { EventosAdapter } from './infrastructure/adapters/eventos.adapter';
import { GoogleAgendaAdapter } from './infrastructure/adapters/google-agenda.adapter';
import { SugestoesAdapter } from './infrastructure/adapters/sugestoes.adapter';
import { TransacaoAdapter } from './infrastructure/adapters/transacao.adapter';
import { UsuariosAdapter } from './infrastructure/adapters/usuarios.adapter';
import { VotosAdapter } from './infrastructure/adapters/votos.adapter';
import { prazosDaConfiguracao } from './infrastructure/config/prazos.provider';
import { IniciativaListagemQuery } from './infrastructure/persistence/iniciativa-listagem.query';
import { PrismaIniciativaRepository } from './infrastructure/persistence/prisma-iniciativa.repository';
import { TransicoesJob } from './infrastructure/scheduler/transicoes.job';
import {
  EVENTOS_PORT,
  GOOGLE_AGENDA_PORT,
  INICIATIVA_LEITURA,
  INICIATIVA_REPOSITORY,
  PRAZOS_CONFIG,
  SUGESTOES_PORT,
  TRANSACAO_PORT,
  USUARIOS_PORT,
  VOTOS_PORT,
} from './iniciativas.tokens';
import { IniciativasController } from './presentation/http/iniciativas.controller';

@Module({
  imports: [
    IdentidadeModule,
    forwardRef(() => RefinamentoModule),
    forwardRef(() => VotacaoModule),
    forwardRef(() => DivulgacaoModule),
  ],
  controllers: [IniciativasController],
  providers: [
    { provide: INICIATIVA_REPOSITORY, useClass: PrismaIniciativaRepository },
    { provide: INICIATIVA_LEITURA, useClass: IniciativaListagemQuery },
    { provide: USUARIOS_PORT, useClass: UsuariosAdapter },
    { provide: SUGESTOES_PORT, useClass: SugestoesAdapter },
    { provide: VOTOS_PORT, useClass: VotosAdapter },
    { provide: GOOGLE_AGENDA_PORT, useClass: GoogleAgendaAdapter },
    { provide: TRANSACAO_PORT, useClass: TransacaoAdapter },
    { provide: EVENTOS_PORT, useClass: EventosAdapter },
    { provide: PRAZOS_CONFIG, useFactory: prazosDaConfiguracao, inject: [ConfigService] },
    {
      provide: CarregarComPrazos,
      useFactory: (
        repositorio: IniciativaRepository,
        transacao: TransacaoPort,
        eventos: EventosPort,
        clock: Clock,
        prazos: PrazosConfig,
      ) => new CarregarComPrazos(repositorio, transacao, eventos, clock, prazos),
      inject: [INICIATIVA_REPOSITORY, TRANSACAO_PORT, EVENTOS_PORT, CLOCK, PRAZOS_CONFIG],
    },
    {
      provide: ComandosIniciativa,
      useFactory: (
        repositorio: IniciativaRepository,
        transacao: TransacaoPort,
        eventos: EventosPort,
        clock: Clock,
        prazos: PrazosConfig,
        carregar: CarregarComPrazos,
      ) => new ComandosIniciativa({ repositorio, transacao, eventos, clock, prazos, carregar }),
      inject: [
        INICIATIVA_REPOSITORY,
        TRANSACAO_PORT,
        EVENTOS_PORT,
        CLOCK,
        PRAZOS_CONFIG,
        CarregarComPrazos,
      ],
    },
    {
      provide: ConsultasIniciativas,
      useFactory: (
        leitura: IniciativaLeituraPort,
        usuarios: UsuariosPort,
        sugestoes: SugestoesPort,
        votos: VotosPort,
        googleAgenda: GoogleAgendaPort,
        carregar: CarregarComPrazos,
        clock: Clock,
      ) =>
        new ConsultasIniciativas({
          leitura,
          usuarios,
          sugestoes,
          votos,
          googleAgenda,
          carregar,
          clock,
        }),
      inject: [
        INICIATIVA_LEITURA,
        USUARIOS_PORT,
        SUGESTOES_PORT,
        VOTOS_PORT,
        GOOGLE_AGENDA_PORT,
        CarregarComPrazos,
        CLOCK,
      ],
    },
    {
      provide: AplicarPrazosVencidos,
      useFactory: (repositorio: IniciativaRepository, carregar: CarregarComPrazos, clock: Clock) =>
        new AplicarPrazosVencidos(repositorio, carregar, clock),
      inject: [INICIATIVA_REPOSITORY, CarregarComPrazos, CLOCK],
    },
    {
      provide: IniciativasFacade,
      useFactory: (
        comandos: ComandosIniciativa,
        consultas: ConsultasIniciativas,
        carregar: CarregarComPrazos,
        job: AplicarPrazosVencidos,
      ) => new IniciativasFacade(comandos, consultas, carregar, job),
      inject: [ComandosIniciativa, ConsultasIniciativas, CarregarComPrazos, AplicarPrazosVencidos],
    },
    TransicoesJob,
  ],
  exports: [IniciativasFacade, TransicoesJob],
})
export class IniciativasModule {}
