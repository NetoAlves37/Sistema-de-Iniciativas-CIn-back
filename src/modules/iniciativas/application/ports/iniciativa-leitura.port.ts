import type { Periodicidade, StatusIniciativa, TipoIniciativa } from '../dto/iniciativa.dto';

/** Linha de leitura de uma iniciativa, já com o placar do ciclo atual. */
export interface LinhaResumo {
  id: string;
  autorId: string;
  tipo: TipoIniciativa;
  titulo: string;
  resumo: string;
  status: StatusIniciativa;
  comVotacao: boolean;
  ciclo: number;
  fimRefinamento: Date | null;
  fimVotacao: Date | null;
  /** `YYYY-MM-DD` */
  inicio: string;
  fim: string;
  periodicidade: Periodicidade;
  espaco: string;
  criadaEm: Date;
  decididaEm: Date | null;
  likes: number;
  dislikes: number;
  relevancia: number;
}

export interface LinhaDetalhe extends LinhaResumo {
  detalhe: string;
  horaInicio: string | null;
  horaFim: string | null;
  organizadores: string;
  membros: string | null;
  participantes: number;
  decisorId: string | null;
  justificativa: string | null;
}

export interface LinhaHistorico {
  id: string;
  ciclo: number;
  de: StatusIniciativa | null;
  para: StatusIniciativa;
  por: string;
  nota: string;
  justificativa: string | null;
  ocorreuEm: Date;
}

export interface LinhaCalendario {
  id: string;
  titulo: string;
  tipo: TipoIniciativa;
  resumo: string;
  inicio: string;
  fim: string;
  horaInicio: string | null;
  horaFim: string | null;
  periodicidade: Periodicidade;
  espaco: string;
  organizadores: string;
  autorId: string;
}

export interface FiltroLeitura {
  status?: StatusIniciativa;
  tipo?: TipoIniciativa;
  q?: string;
  autorId?: string;
  ordenar: 'relevancia' | 'prazo' | 'recentes' | 'inicio';
  page: number;
  limit: number;
}

/**
 * Modelo de leitura das iniciativas (listagens com filtros, ordenação e paginação no
 * banco, RNF-05). A implementação junta o placar de votos para ordenar por relevância.
 */
export interface IniciativaLeituraPort {
  listar(filtro: FiltroLeitura): Promise<{ linhas: LinhaResumo[]; total: number }>;
  contagemPorStatus(autorId: string): Promise<Partial<Record<StatusIniciativa, number>>>;
  contarPorStatus(status: StatusIniciativa): Promise<number>;
  obterLinha(id: string): Promise<LinhaDetalhe | null>;
  historico(id: string): Promise<LinhaHistorico[]>;
  aprovadasParaCalendario(filtro: {
    de: string;
    ate: string;
    tipos?: TipoIniciativa[];
    autorId?: string;
  }): Promise<LinhaCalendario[]>;
}
