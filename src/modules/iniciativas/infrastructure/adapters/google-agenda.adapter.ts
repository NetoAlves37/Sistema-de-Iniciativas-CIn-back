import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DivulgacaoFacade } from '@/modules/divulgacao/application/divulgacao.facade';
import type {
  DadosGoogleAgenda,
  GoogleAgendaPort,
} from '../../application/ports/google-agenda.port';

type DadosDivulgacao = Parameters<DivulgacaoFacade['googleAgendaUrl']>[0];

/** Resolve `DivulgacaoFacade` na primeira chamada: `iniciativas` e `divulgacao` dependem um do outro. */
@Injectable()
export class GoogleAgendaAdapter implements GoogleAgendaPort {
  private divulgacao?: DivulgacaoFacade;

  constructor(private readonly moduleRef: ModuleRef) {}

  url(dados: DadosGoogleAgenda): string {
    this.divulgacao ??= this.moduleRef.get(DivulgacaoFacade, { strict: false });
    return this.divulgacao.googleAgendaUrl({
      ...dados,
      periodicidade: dados.periodicidade as DadosDivulgacao['periodicidade'],
    });
  }
}
