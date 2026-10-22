import type {
  AprovadaParaCalendario,
  ResumoIniciativa,
  TipoIniciativa,
} from '../dto/divulgacao.dto';

export interface FiltroAprovadas {
  q?: string;
  tipo?: TipoIniciativa;
  page: number;
  limit: number;
}

export interface FiltroCalendario {
  /** `YYYY-MM-DD`, inclusivo. */
  de: string;
  /** `YYYY-MM-DD`, exclusivo. */
  ate: string;
  tipos?: TipoIniciativa[];
  autorId?: string;
}

/** Porta para o módulo `iniciativas` (implementada em `infrastructure/adapters`). */
export interface IniciativasPort {
  /** Aprovadas, em ordem crescente de `inicio`. */
  listarAprovadas(filtro: FiltroAprovadas): Promise<{ items: ResumoIniciativa[]; total: number }>;
  aprovadasParaCalendario(filtro: FiltroCalendario): Promise<AprovadaParaCalendario[]>;
}
