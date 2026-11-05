import type { Iniciativa } from '../iniciativa';

export interface IniciativaRepository {
  buscarPorId(id: string): Promise<Iniciativa | null>;

  /** Grava uma iniciativa nova (com o histórico inicial). */
  criar(iniciativa: Iniciativa): Promise<void>;

  /**
   * Grava as mudanças e as transições novas do histórico, com concorrência otimista:
   * lança `ConcorrenciaError` se outra gravação mudou a iniciativa desde a leitura.
   */
  salvar(iniciativa: Iniciativa): Promise<void>;

  /** Ids de iniciativas em andamento ou em votação cujo prazo já venceu em `agora`. */
  idsComPrazoVencido(agora: Date, limite: number): Promise<string[]>;
}
