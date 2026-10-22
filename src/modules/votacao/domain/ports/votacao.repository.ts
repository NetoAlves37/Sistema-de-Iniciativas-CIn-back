import type { MeuVoto, ValorVoto } from '../voto';

export interface Placar {
  likes: number;
  dislikes: number;
  relevancia: number;
}

export interface ParIniciativaCiclo {
  iniciativaId: string;
  ciclo: number;
}

/** Persistência de votos e placares. Toda a escrita roda dentro de uma transação. */
export interface VotacaoRepository {
  /** Cria a linha do placar de `(iniciativa, ciclo)` se não existir (idempotente). */
  garantirPlacar(iniciativaId: string, ciclo: number): Promise<void>;

  /** Trava a linha do placar até o fim da transação (serializa votos da mesma iniciativa). */
  travarPlacar(iniciativaId: string, ciclo: number): Promise<void>;

  buscarVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<MeuVoto>;

  gravarVoto(
    iniciativaId: string,
    ciclo: number,
    usuarioId: string,
    valor: ValorVoto,
  ): Promise<void>;

  removerVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<void>;

  /** Conta os votos do ciclo na tabela de votos. */
  contarVotos(iniciativaId: string, ciclo: number): Promise<{ likes: number; dislikes: number }>;

  salvarPlacar(iniciativaId: string, ciclo: number, placar: Placar): Promise<void>;

  /** `null` se ainda não existe linha de placar. */
  buscarPlacar(iniciativaId: string, ciclo: number): Promise<Placar | null>;

  /** Placares dos pares pedidos. Chave = `iniciativaId`; ausente = sem votos. */
  buscarPlacares(pares: ParIniciativaCiclo[]): Promise<Map<string, Placar>>;
}
