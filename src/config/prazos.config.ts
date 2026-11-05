import { registerAs } from '@nestjs/config';

const DEFAULT_DIAS = 3;

function parseDias(raw: string | undefined): number {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : DEFAULT_DIAS;
}

/** Prazos do ciclo de vida da iniciativa e agendamento das transições (RN-06, RNF-04). */
export default registerAs('prazos', () => ({
  refinamentoDias: parseDias(process.env.PRAZO_REFINAMENTO_DIAS),
  votacaoDias: parseDias(process.env.PRAZO_VOTACAO_DIAS),
  // Padrão: a cada minuto.
  transicoesCron: process.env.TRANSICOES_CRON?.trim() || '*/1 * * * *',
  // Fuso de negócio (RNF-04).
  timezone: process.env.APP_TIMEZONE?.trim() || 'America/Recife',
}));
