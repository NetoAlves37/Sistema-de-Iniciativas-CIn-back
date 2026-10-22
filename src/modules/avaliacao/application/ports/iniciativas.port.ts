import type { DetalheIniciativa, ResumoIniciativa } from '../dto/avaliacao.dto';

export interface AtorAvaliacao {
  id: string;
  nome: string;
  ehComite: boolean;
}

export interface DecisaoRegistrada {
  iniciativaId: string;
  resultado: 'APROVADA' | 'REPROVADA';
  justificativa: string | null;
  decisorId: string;
}

/** Porta para o módulo `iniciativas` (implementada em `infrastructure/adapters`). */
export interface IniciativasPort {
  /** Iniciativas em Em análise, da mais para a menos relevante. */
  listarEmAnalise(
    page: number,
    limit: number,
  ): Promise<{ items: ResumoIniciativa[]; total: number }>;
  /** As regras do agregado (autor, status, concorrência) vivem do lado de `iniciativas`. */
  registrarDecisao(decisao: DecisaoRegistrada): Promise<void>;
  detalhe(iniciativaId: string, ator: AtorAvaliacao): Promise<DetalheIniciativa>;
}
