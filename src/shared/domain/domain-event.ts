/** Base dos eventos de domínio: classes imutáveis, com o instante em que ocorreram. */
export abstract class DomainEvent {
  constructor(readonly ocorreuEm: Date) {}
}
