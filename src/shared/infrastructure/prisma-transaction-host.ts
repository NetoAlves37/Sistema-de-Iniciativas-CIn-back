import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * Guarda o `TransactionClient` corrente num `AsyncLocalStorage`. Casos de uso de escrita
 * rodam em `run(...)`; repositórios e adaptadores pedem `client` e recebem a transação
 * quando existe uma (ou o cliente normal, fora dela). Chamadas aninhadas de `run`
 * entram na transação já aberta.
 */
@Injectable()
export class PrismaTransactionHost {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaExecutor {
    return this.storage.getStore() ?? this.prisma;
  }

  get emTransacao(): boolean {
    return this.storage.getStore() !== undefined;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) {
      return work();
    }
    return this.prisma.$transaction((tx) => this.storage.run(tx, work), {
      timeout: TRANSACTION_TIMEOUT_MS,
    });
  }
}
