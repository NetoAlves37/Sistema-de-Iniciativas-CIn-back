import type { StatusIniciativa } from '../../domain/status';
import type { Periodicidade, TipoIniciativa } from '../../domain/tipos';

export type { Periodicidade, StatusIniciativa, TipoIniciativa };

export type PerfilExibicao = 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN';

export interface AutorDto {
  id: string;
  nome: string;
  perfil: PerfilExibicao;
}

export interface VotosDto {
  likes: number;
  dislikes: number;
  relevancia: number;
}

/** Item das listas (home, minhas, fila, aprovadas). Datas como string ISO. */
export interface ResumoIniciativaDto {
  id: string;
  tipo: TipoIniciativa;
  titulo: string;
  resumo: string;
  autor: AutorDto;
  status: StatusIniciativa;
  comVotacao: boolean;
  ciclo: number;
  fimRefinamento: string | null;
  fimVotacao: string | null;
  /** Prazo que importa agora: `fimRefinamento` em Em andamento, `fimVotacao` em Em votação. */
  prazoAtual: string | null;
  votos: VotosDto;
  sugestoesCicloAtual: number;
  /** `YYYY-MM-DD` */
  inicio: string;
  fim: string;
  periodicidade: Periodicidade;
  espaco: string;
  criadaEm: string;
  /** Instante da decisão do comitê (aprovada ou reprovada); null nos demais status. */
  decididaEm: string | null;
}

export interface PermissoesDto {
  podeEditar: boolean;
  podeComentar: boolean;
  podeVotar: boolean;
  podeDecidir: boolean;
  /** Preenchida quando o usuário é do comitê, a iniciativa está em análise e ele não pode decidir. */
  motivoNaoPodeDecidir?: string;
  podeRessubmeter: boolean;
}

export interface DecisaoDto {
  resultado: 'APROVADA' | 'REPROVADA';
  justificativa: string | null;
  decisor: { nome: string };
  decididaEm: string;
}

export interface DetalheIniciativaDto extends ResumoIniciativaDto {
  detalhe: string;
  /** `HH:mm` ou null (dia inteiro). */
  horaInicio: string | null;
  horaFim: string | null;
  organizadores: string;
  membros: string | null;
  participantes: number;
  /** 1 (like), -1 (dislike) ou 0 (sem voto), no ciclo atual. */
  meuVoto: 1 | -1 | 0;
  permissoes: PermissoesDto;
  decisao: DecisaoDto | null;
  /** Justificativa da última reprovação, para a tela de ressubmissão. */
  ultimaJustificativa: string | null;
  /** Só para iniciativas aprovadas. */
  googleAgendaUrl: string | null;
}

export interface TransicaoDto {
  id: string;
  ciclo: number;
  de: StatusIniciativa | null;
  para: StatusIniciativa;
  /** Nome do usuário, ou `Sistema`. */
  por: string;
  nota: string;
  justificativa: string | null;
  ocorreuEm: string;
}

/** Campos de entrada de uma iniciativa (RN-01 e RN-02), como chegam do HTTP. */
export interface DadosIniciativaInput {
  tipo: string;
  titulo: string;
  resumo: string;
  detalhe: string;
  inicio: string;
  fim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  periodicidade: string;
  espaco: string;
  organizadores: string;
  membros?: string | null;
  participantes: number;
  comVotacao?: boolean;
}

export type OrdenacaoListagem = 'relevancia' | 'prazo' | 'recentes' | 'inicio';

export interface FiltroListagemDto {
  status?: StatusIniciativa;
  tipo?: TipoIniciativa;
  /** Busca case-insensitive em título, resumo, organizadores e espaço. */
  q?: string;
  autorId?: string;
  ordenar?: OrdenacaoListagem;
  page: number;
  limit: number;
}

export interface PaginaDto<T> {
  items: T[];
  total: number;
}

/** Ator de uma operação: quem está pedindo e se pode agir como comitê. */
export interface AtorDto {
  id: string;
  nome: string;
  /** Membro do comitê ou administrador: pode ver a fila e decidir. */
  ehComite: boolean;
}

/** O que os outros módulos precisam saber do estado de uma iniciativa. */
export interface EstadoIniciativaDto {
  id: string;
  autorId: string;
  status: StatusIniciativa;
  ciclo: number;
  comVotacao: boolean;
  fimRefinamento: string | null;
  fimVotacao: string | null;
}

/** Dados de uma iniciativa aprovada, para gerar ocorrências do calendário (RN-12). */
export interface AprovadaParaCalendarioDto {
  id: string;
  titulo: string;
  tipo: TipoIniciativa;
  resumo: string;
  /** `YYYY-MM-DD` */
  inicio: string;
  fim: string;
  horaInicio: string | null;
  horaFim: string | null;
  periodicidade: Periodicidade;
  espaco: string;
  organizadores: string;
  autorId: string;
}
