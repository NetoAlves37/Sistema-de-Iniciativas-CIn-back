import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RefinamentoFacade } from '@/modules/refinamento/application/refinamento.facade';
import type { SugestoesPort } from '../../application/ports/sugestoes.port';

/**
 * `iniciativas` e `refinamento` dependem um do outro. Para não criar um ciclo de providers,
 * a fachada do outro módulo é resolvida na primeira chamada (e não na construção).
 */
@Injectable()
export class SugestoesAdapter implements SugestoesPort {
  private refinamento?: RefinamentoFacade;

  constructor(private readonly moduleRef: ModuleRef) {}

  contar(pares: Array<{ iniciativaId: string; ciclo: number }>): Promise<Map<string, number>> {
    this.refinamento ??= this.moduleRef.get(RefinamentoFacade, { strict: false });
    return this.refinamento.contarSugestoes(pares);
  }
}
