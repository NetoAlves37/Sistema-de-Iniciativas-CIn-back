import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@/shared/domain/domain-event';
import { DomainEventPublisher } from '@/shared/infrastructure/domain-event-publisher';
import type { EventosPort } from '../../application/ports/eventos.port';

@Injectable()
export class EventosAdapter implements EventosPort {
  constructor(private readonly publicador: DomainEventPublisher) {}

  publicar(eventos: DomainEvent[]): void {
    this.publicador.publicar(eventos);
  }
}
