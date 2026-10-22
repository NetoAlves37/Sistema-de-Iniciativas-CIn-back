/** Executa o trabalho numa transação (adapter sobre o `PrismaTransactionHost`). */
export interface TransacaoPort {
  run<T>(trabalho: () => Promise<T>): Promise<T>;
}
