import type { RegistroTipo, TipoDeIniciativa } from '../tipo-de-iniciativa';

/** Quem fez a ação (vai para o log de auditoria). */
export interface AutorRegistro {
  id: string;
  nome: string;
}

export interface TipoRepository {
  buscarPorId(id: number): Promise<TipoDeIniciativa | null>;

  /** Todos os tipos, ativos e inativos, em ordem alfabética de nome. */
  listar(): Promise<TipoDeIniciativa[]>;

  /** Códigos dos tipos ativos (os que podem ser escolhidos numa iniciativa). */
  codigosAtivos(): Promise<string[]>;

  /** Quantas iniciativas usam cada tipo, por id (tipos sem nenhuma ficam de fora). */
  contarIniciativas(): Promise<Map<number, number>>;

  /** Grava um tipo novo e os registros pendentes do log. Devolve o id gerado. */
  criar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<number>;

  /** Grava as mudanças e os registros pendentes do log. */
  salvar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<void>;

  /**
   * Exclui o tipo e grava o registro da exclusão. Lança `TipoEmUsoError` se alguma
   * iniciativa passou a usá-lo nesse meio-tempo (a FK do banco garante).
   */
  excluir(
    tipo: TipoDeIniciativa,
    registro: RegistroTipo,
    autor: AutorRegistro,
    agora: Date,
  ): Promise<void>;
}
