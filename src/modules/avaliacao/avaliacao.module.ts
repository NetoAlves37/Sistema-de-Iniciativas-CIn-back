import { forwardRef, Module } from '@nestjs/common';
import { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import { IniciativasModule } from '@/modules/iniciativas/iniciativas.module';
import type { IniciativasPort } from './application/ports/iniciativas.port';
import { ObterFila } from './application/queries/obter-fila';
import { RegistrarDecisao } from './application/use-cases/registrar-decisao';
import { INICIATIVAS_PORT } from './avaliacao.tokens';
import { IniciativasFacadeAdapter } from './infrastructure/adapters/iniciativas-facade.adapter';
import { AvaliacaoController } from './presentation/http/avaliacao.controller';

/** Fila e decisão do comitê. Sem tabelas: tudo passa pela fachada de `iniciativas`. */
@Module({
  imports: [forwardRef(() => IniciativasModule)],
  controllers: [AvaliacaoController],
  providers: [
    {
      provide: INICIATIVAS_PORT,
      useFactory: (facade: IniciativasFacade) => new IniciativasFacadeAdapter(facade),
      inject: [IniciativasFacade],
    },
    {
      provide: ObterFila,
      useFactory: (port: IniciativasPort) => new ObterFila(port),
      inject: [INICIATIVAS_PORT],
    },
    {
      provide: RegistrarDecisao,
      useFactory: (port: IniciativasPort) => new RegistrarDecisao(port),
      inject: [INICIATIVAS_PORT],
    },
  ],
})
export class AvaliacaoModule {}
