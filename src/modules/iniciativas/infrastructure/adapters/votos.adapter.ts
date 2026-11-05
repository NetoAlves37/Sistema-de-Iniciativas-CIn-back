import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VotacaoFacade } from '@/modules/votacao/application/votacao.facade';
import type { VotosPort } from '../../application/ports/votos.port';

/** Resolve `VotacaoFacade` na primeira chamada: `iniciativas` e `votacao` dependem um do outro. */
@Injectable()
export class VotosAdapter implements VotosPort {
  private votacao?: VotacaoFacade;

  constructor(private readonly moduleRef: ModuleRef) {}

  meuVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<1 | -1 | 0> {
    this.votacao ??= this.moduleRef.get(VotacaoFacade, { strict: false });
    return this.votacao.meuVoto(iniciativaId, ciclo, usuarioId);
  }
}
