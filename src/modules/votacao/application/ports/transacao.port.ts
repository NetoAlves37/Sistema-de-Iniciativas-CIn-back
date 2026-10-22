export interface TransacaoPort {
  /** Executa `trabalho` numa transação; repositórios usam a transação corrente. */
  run<T>(trabalho: () => Promise<T>): Promise<T>;
}
