import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '@/shared/infrastructure/prisma-transaction-host';
import type { TransacaoPort } from '../../application/ports/transacao.port';

@Injectable()
export class TransacaoAdapter implements TransacaoPort {
  constructor(private readonly host: PrismaTransactionHost) {}

  run<T>(trabalho: () => Promise<T>): Promise<T> {
    return this.host.run(trabalho);
  }
}
