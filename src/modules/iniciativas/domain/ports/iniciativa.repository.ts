import type { Iniciativa } from '../iniciativa';

/** O que identifica "a mesma submissão" de um autor. */
export interface FiltroDuplicidade {
  autorId: string;
  titulo: string;
  /** `YYYY-MM-DD`. */
  inicio: string;
  /** `HH:MM`, ou `null` quando a iniciativa não tem horário. */
  horaInicio: string | null;
}

export interface IniciativaRepository {
  buscarPorId(id: string): Promise<Iniciativa | null>;

  /** Grava uma iniciativa nova (com o histórico inicial). */
  criar(iniciativa: Iniciativa): Promise<void>;

  /**
   * Grava as mudanças e as transições novas do histórico, com concorrência otimista:
   * lança `ConcorrenciaError` se outra gravação mudou a iniciativa desde a leitura.
   */
  salvar(iniciativa: Iniciativa): Promise<void>;

  /**
   * Diz se o autor já tem uma iniciativa ativa (`STATUS_ATIVOS`) com o mesmo título (sem
   * diferenciar maiúsculas), a mesma data de início e o mesmo horário de início (`null` só
   * casa com `null`). Chamado dentro da transação da submissão: a implementação deve
   * serializar as submissões do mesmo autor até o fim da transação, para que dois envios
   * simultâneos não passem os dois.
   */
  existeAtivaIgual(filtro: FiltroDuplicidade): Promise<boolean>;

  /** Ids de iniciativas em andamento ou em votação cujo prazo já venceu em `agora`. */
  idsComPrazoVencido(agora: Date, limite: number): Promise<string[]>;
}
