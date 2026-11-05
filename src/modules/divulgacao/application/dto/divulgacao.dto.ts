import type { Periodicidade, TipoIniciativa } from '../../domain/periodicidade';

export type { Periodicidade, TipoIniciativa };

/** Espelho estrutural do resumo de `iniciativas` (o módulo só o repassa). */
export interface ResumoIniciativa {
  id: string;
  tipo: TipoIniciativa;
  titulo: string;
  resumo: string;
  autor: { id: string; nome: string; perfil: 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN' };
  status: 'EM_ANDAMENTO' | 'EM_VOTACAO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  comVotacao: boolean;
  ciclo: number;
  fimRefinamento: string | null;
  fimVotacao: string | null;
  prazoAtual: string | null;
  votos: { likes: number; dislikes: number; relevancia: number };
  sugestoesCicloAtual: number;
  inicio: string;
  fim: string;
  periodicidade: Periodicidade;
  espaco: string;
  criadaEm: string;
  /** Instante da decisão do comitê; null nos demais status. */
  decididaEm: string | null;
}

/** Iniciativa aprovada, com o que o calendário precisa. */
export interface AprovadaParaCalendario {
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

/** Ocorrência no calendário, como a API devolve. */
export interface OcorrenciaCalendario {
  iniciativaId: string;
  titulo: string;
  tipo: TipoIniciativa;
  /** `YYYY-MM-DD` (dia inteiro) ou `YYYY-MM-DDTHH:mm`. */
  inicio: string;
  /** Mesmo formato do início. Exclusivo no Evento único de dia inteiro. */
  fim: string;
  diaInteiro: boolean;
  espaco: string;
  organizadores: string;
  periodicidade: Periodicidade;
  periodoInicio: string;
  periodoFim: string;
  googleAgendaUrl: string;
}
