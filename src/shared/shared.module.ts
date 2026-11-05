import { Global, Module } from '@nestjs/common';
import { DomainEventPublisher } from './infrastructure/domain-event-publisher';
import { PrismaTransactionHost } from './infrastructure/prisma-transaction-host';
import { SystemClock } from './infrastructure/system-clock';
import { CLOCK } from './shared.tokens';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    PrismaTransactionHost,
    DomainEventPublisher,
  ],
  exports: [CLOCK, PrismaTransactionHost, DomainEventPublisher],
})
export class SharedModule {}
