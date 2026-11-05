import { DomainEvent } from '@/shared/domain/domain-event';

/** Eventos de domínio de `iniciativas`: imutáveis, com `iniciativaId`, `ciclo` e `ocorreuEm`. */
abstract class EventoDeIniciativa extends DomainEvent {
  constructor(
    readonly iniciativaId: string,
    readonly ciclo: number,
    ocorreuEm: Date,
  ) {
    super(ocorreuEm);
  }
}

export class IniciativaSubmetida extends EventoDeIniciativa {}

export class IniciativaEditada extends EventoDeIniciativa {}

export class RefinamentoEncerrado extends EventoDeIniciativa {
  constructor(
    iniciativaId: string,
    ciclo: number,
    ocorreuEm: Date,
    /** Para onde a iniciativa foi: votação ou direto para a análise. */
    readonly proximoStatus: 'EM_VOTACAO' | 'EM_ANALISE',
  ) {
    super(iniciativaId, ciclo, ocorreuEm);
  }
}

export class VotacaoEncerrada extends EventoDeIniciativa {}

export class IniciativaDecidida extends EventoDeIniciativa {
  constructor(
    iniciativaId: string,
    ciclo: number,
    ocorreuEm: Date,
    readonly resultado: 'APROVADA' | 'REPROVADA',
    readonly decisorId: string,
  ) {
    super(iniciativaId, ciclo, ocorreuEm);
  }
}

export class IniciativaRessubmetida extends EventoDeIniciativa {}
