export const STATUS_INICIATIVA = [
  'EM_ANDAMENTO',
  'EM_VOTACAO',
  'EM_ANALISE',
  'APROVADA',
  'REPROVADA',
] as const;

export type StatusIniciativa = (typeof STATUS_INICIATIVA)[number];

export const ROTULO_STATUS: Record<StatusIniciativa, string> = {
  EM_ANDAMENTO: 'Em andamento',
  EM_VOTACAO: 'Em votação',
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
};

/**
 * Status em que a iniciativa ainda está valendo: todos menos Reprovada. Uma submissão nova
 * igual a uma iniciativa ativa do mesmo autor é recusada (`IniciativaDuplicadaError`); para
 * uma reprovada, o caminho é ressubmeter (ADR-026).
 */
export const STATUS_ATIVOS: readonly StatusIniciativa[] = [
  'EM_ANDAMENTO',
  'EM_VOTACAO',
  'EM_ANALISE',
  'APROVADA',
];

export const ehStatus = (valor: string): valor is StatusIniciativa =>
  (STATUS_INICIATIVA as readonly string[]).includes(valor);

/** Operações que dependem do status (usadas na tabela de transições inválidas). */
export type Operacao =
  | 'editar'
  | 'ressubmeter'
  | 'decidir'
  | 'encerrarRefinamento'
  | 'encerrarVotacao';
