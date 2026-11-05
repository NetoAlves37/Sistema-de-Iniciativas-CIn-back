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

export const ehStatus = (valor: string): valor is StatusIniciativa =>
  (STATUS_INICIATIVA as readonly string[]).includes(valor);

/** Operações que dependem do status (usadas na tabela de transições inválidas). */
export type Operacao =
  | 'editar'
  | 'ressubmeter'
  | 'decidir'
  | 'encerrarRefinamento'
  | 'encerrarVotacao';
