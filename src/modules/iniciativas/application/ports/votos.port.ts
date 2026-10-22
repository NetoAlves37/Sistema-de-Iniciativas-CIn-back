/** Voto do usuário (implementada com o módulo `votacao`). */
export interface VotosPort {
  /** 1 (like), -1 (dislike) ou 0 (sem voto), no ciclo informado. */
  meuVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<1 | -1 | 0>;
}
