import { forwardRef, Module } from '@nestjs/common';
import { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import { IniciativasModule } from '@/modules/iniciativas/iniciativas.module';
import { DivulgacaoFacade } from './application/divulgacao.facade';
import type { IniciativasPort } from './application/ports/iniciativas.port';
import { ListarAprovadas } from './application/queries/listar-aprovadas';
import { ListarOcorrencias } from './application/queries/listar-ocorrencias';
import { INICIATIVAS_PORT } from './divulgacao.tokens';
import { IniciativasFacadeAdapter } from './infrastructure/adapters/iniciativas-facade.adapter';
import { DivulgacaoController } from './presentation/http/divulgacao.controller';

/**
 * Listagem de aprovadas, ocorrências do calendário e link do Google Agenda. Sem tabelas.
 * Dependência circular com `iniciativas`, que usa a `DivulgacaoFacade` no detalhe.
 */
@Module({
  imports: [forwardRef(() => IniciativasModule)],
  controllers: [DivulgacaoController],
  providers: [
    {
      provide: INICIATIVAS_PORT,
      useFactory: (facade: IniciativasFacade) => new IniciativasFacadeAdapter(facade),
      inject: [IniciativasFacade],
    },
    {
      provide: ListarAprovadas,
      useFactory: (port: IniciativasPort) => new ListarAprovadas(port),
      inject: [INICIATIVAS_PORT],
    },
    {
      provide: ListarOcorrencias,
      useFactory: (port: IniciativasPort) => new ListarOcorrencias(port),
      inject: [INICIATIVAS_PORT],
    },
    { provide: DivulgacaoFacade, useFactory: () => new DivulgacaoFacade() },
  ],
  exports: [DivulgacaoFacade],
})
export class DivulgacaoModule {}
