/** Prazos do ciclo de vida da iniciativa, em dias (aceita fração). Vêm da configuração. */
export interface PrazosConfig {
  readonly refinamentoDias: number;
  readonly votacaoDias: number;
}

export const MS_POR_DIA = 24 * 60 * 60 * 1000;
