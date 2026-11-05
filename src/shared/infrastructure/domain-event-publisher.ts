import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '../domain/domain-event';

/** Publica eventos de domínio no `@nestjs/event-emitter`, pelo nome da classe do evento. */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  publicar(eventos: DomainEvent[]): void {
    for (const evento of eventos) {
      this.emitter.emit(evento.constructor.name, evento);
    }
  }
}
