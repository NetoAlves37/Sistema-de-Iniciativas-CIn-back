/** Contagem de sugestões (comentários) do ciclo (implementada com o módulo `refinamento`). */
export interface SugestoesPort {
  /** Chave do mapa = `iniciativaId`; ausente = 0. */
  contar(pares: Array<{ iniciativaId: string; ciclo: number }>): Promise<Map<string, number>>;
}
