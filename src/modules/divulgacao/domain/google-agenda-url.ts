import { somarDias } from './datas';
import type { Periodicidade } from './periodicidade';

export interface DadosGoogleAgenda {
  titulo: string;
  resumo: string;
  /** `YYYY-MM-DD` */
  inicio: string;
  fim: string;
  /** `HH:mm` ou `null` (dia inteiro). */
  horaInicio: string | null;
  horaFim: string | null;
  periodicidade: Periodicidade;
  espaco: string;
  organizadores: string;
}

const BASE = 'https://calendar.google.com/calendar/render?';

const REGRA_POR_PERIODICIDADE: Partial<Record<Periodicidade, string>> = {
  DIARIA: 'FREQ=DAILY',
  SEMANAL: 'FREQ=WEEKLY',
  QUINZENAL: 'FREQ=WEEKLY;INTERVAL=2',
  MENSAL: 'FREQ=MONTHLY',
};

const semTracos = (dia: string) => dia.replace(/-/g, '');
const horaCompacta = (hora: string) => `${hora.replace(':', '')}00`;

/** Link "Adicionar ao Google Agenda" (HU-20): porte fiel de `gcalUrl()` do protótipo. */
export function googleAgendaUrl(dados: DadosGoogleAgenda): string {
  const multiplosDias = dados.inicio !== dados.fim;
  let dates: string;
  if (dados.horaInicio) {
    const horaFim = dados.horaFim ?? dados.horaInicio;
    dates = `${semTracos(dados.inicio)}T${horaCompacta(dados.horaInicio)}/${semTracos(dados.inicio)}T${horaCompacta(horaFim)}`;
  } else {
    const base = dados.periodicidade === 'EVENTO_UNICO' ? dados.fim : dados.inicio;
    dates = `${semTracos(dados.inicio)}/${semTracos(somarDias(base, 1))}`;
  }

  let regra = '';
  const regraDaPeriodicidade = REGRA_POR_PERIODICIDADE[dados.periodicidade];
  if (regraDaPeriodicidade && multiplosDias) regra = regraDaPeriodicidade;
  else if (dados.periodicidade === 'EVENTO_UNICO' && multiplosDias && dados.horaInicio) {
    regra = 'FREQ=DAILY';
  }

  const parametros: Record<string, string> = {
    action: 'TEMPLATE',
    text: dados.titulo,
    dates,
    ctz: 'America/Recife',
    details: `${dados.resumo}\n\nOrganizadores: ${dados.organizadores}\nIniciativa aprovada no Sistema de Iniciativas do CIn/UFPE.`,
    location: `${dados.espaco}, Centro de Informática - UFPE`,
  };
  if (regra) parametros.recur = `RRULE:${regra};UNTIL=${semTracos(dados.fim)}`;
  return BASE + new URLSearchParams(parametros).toString();
}
