/**
 * Executa o trabalho numa transação; os repositórios usam a transação corrente (adapter sobre
 * o `PrismaTransactionHost`).
 */
export interface TransacaoPort {
  run<T>(trabalho: () => Promise<T>): Promise<T>;
}
