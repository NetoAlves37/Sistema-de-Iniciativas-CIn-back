import type {
  ComentarioRepository,
  ParIniciativaCiclo,
} from '../../domain/ports/comentario.repository';

export class ContarSugestoes {
  constructor(private readonly comentarios: ComentarioRepository) {}

  /** Chave = `iniciativaId`; ausente = 0. */
  async executar(pares: ParIniciativaCiclo[]): Promise<Map<string, number>> {
    if (pares.length === 0) return new Map();
    return this.comentarios.contarPorCiclo(pares);
  }
}
