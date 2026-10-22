export type TipoIniciativa = 'EXTENSAO' | 'PESQUISA' | 'EVENTO';
export type StatusIniciativa =
  | 'EM_ANDAMENTO'
  | 'EM_VOTACAO'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'REPROVADA';
export type Periodicidade = 'EVENTO_UNICO' | 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL';

/** Espelho estrutural do resumo de `iniciativas` (o módulo só o repassa). */
export interface ResumoIniciativa {
  id: string;
  tipo: TipoIniciativa;
  titulo: string;
  resumo: string;
  autor: { id: string; nome: string; perfil: 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN' };
  status: StatusIniciativa;
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

/** Espelho estrutural do detalhe de `iniciativas`. */
export interface DetalheIniciativa extends ResumoIniciativa {
  detalhe: string;
  horaInicio: string | null;
  horaFim: string | null;
  organizadores: string;
  membros: string | null;
  participantes: number;
  meuVoto: 1 | -1 | 0;
  permissoes: {
    podeEditar: boolean;
    podeComentar: boolean;
    podeVotar: boolean;
    podeDecidir: boolean;
    motivoNaoPodeDecidir?: string;
    podeRessubmeter: boolean;
  };
  decisao: {
    resultado: 'APROVADA' | 'REPROVADA';
    justificativa: string | null;
    decisor: { nome: string };
    decididaEm: string;
  } | null;
  ultimaJustificativa: string | null;
  googleAgendaUrl: string | null;
}

export interface ItemFila extends ResumoIniciativa {
  /** O usuário logado é o autor: não poderá decidir esta iniciativa (RN-10). */
  souAutor: boolean;
}
