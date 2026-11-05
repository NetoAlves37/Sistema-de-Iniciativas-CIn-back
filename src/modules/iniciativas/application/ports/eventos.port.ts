import type { DomainEvent } from '@/shared/domain/domain-event';

/** Publica eventos de domínio (adapter sobre o `DomainEventPublisher`). */
export interface EventosPort {
  publicar(eventos: DomainEvent[]): void;
}
