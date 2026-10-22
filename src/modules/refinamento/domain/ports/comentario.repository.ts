import type { Comentario } from '../comentario';

export interface ComentarioPersistido {
  id: string;
  iniciativaId: string;
  ciclo: number;
  autorId: string;
  texto: string;
  criadoEm: Date;
}

export interface PaginaDeComentarios {
  items: ComentarioPersistido[];
  total: number;
}

export interface ParIniciativaCiclo {
  iniciativaId: string;
  ciclo: number;
}

export interface ComentarioRepository {
  salvar(comentario: Comentario): Promise<ComentarioPersistido>;

  /** Ordem: ciclo mais recente primeiro; dentro do ciclo, do mais antigo para o mais novo. */
  listarPorIniciativa(
    iniciativaId: string,
    skip: number,
    take: number,
  ): Promise<PaginaDeComentarios>;

  /** Chave do mapa = `iniciativaId`; conta os comentários do ciclo pedido. */
  contarPorCiclo(pares: ParIniciativaCiclo[]): Promise<Map<string, number>>;
}
