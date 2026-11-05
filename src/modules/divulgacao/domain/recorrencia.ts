import { diaDoMes, diaParaNumero, diasNoMes, numeroParaDia, somarDias } from './datas';
import type { Periodicidade } from './periodicidade';

/** O que a recorrência precisa saber de uma iniciativa aprovada. */
export interface PeriodoRecorrente {
  /** `YYYY-MM-DD` */
  inicio: string;
  fim: string;
  /** `HH:mm` ou `null` (dia inteiro). */
  horaInicio: string | null;
  horaFim: string | null;
  periodicidade: Periodicidade;
}

/**
 * Uma ocorrência. Dia inteiro: `inicio` e `fim` são `YYYY-MM-DD`. No Evento único, `fim` é
 * exclusivo (fim do período + 1 dia); nas demais, `fim` é o próprio dia. Com horário:
 * `YYYY-MM-DDTHH:mm`.
 */
export interface Ocorrencia {
  inicio: string;
  fim: string;
  diaInteiro: boolean;
}

/** O dia (em dias desde a época) cai numa ocorrência da periodicidade? Pressupõe `dia` no período. */
function ocorreNoDia(periodicidade: Periodicidade, dia: number, primeiroDia: number): boolean {
  const diferenca = dia - primeiroDia;
  switch (periodicidade) {
    case 'SEMANAL':
      return diferenca % 7 === 0;
    case 'QUINZENAL':
      return diferenca % 14 === 0;
    case 'MENSAL': {
      const alvo = diaDoMes(primeiroDia);
      // Mês sem o dia do início (por exemplo, 31): vale o último dia do mês.
      return diaDoMes(dia) === Math.min(alvo, diasNoMes(dia));
    }
    default:
      return true;
  }
}

/**
 * Ocorrências de uma iniciativa aprovada no intervalo `[de, ate)` (RN-12). `de` e `ate`
 * já validados (`validarIntervalo`). Nunca sai do período `[inicio, fim]`.
 */
export function gerarOcorrencias(
  periodo: PeriodoRecorrente,
  de: string,
  ate: string,
): Ocorrencia[] {
  const primeiro = diaParaNumero(periodo.inicio);
  const ultimo = diaParaNumero(periodo.fim);
  const janelaInicio = diaParaNumero(de);
  const janelaFim = diaParaNumero(ate);
  if (primeiro === null || ultimo === null || janelaInicio === null || janelaFim === null) {
    return [];
  }

  const comHorario = periodo.horaInicio !== null;
  if (periodo.periodicidade === 'EVENTO_UNICO' && !comHorario) {
    // Um bloco só, do início ao fim; `fim` exclusivo.
    const fimExclusivo = ultimo + 1;
    if (primeiro >= janelaFim || fimExclusivo <= janelaInicio) return [];
    return [{ inicio: periodo.inicio, fim: somarDias(periodo.fim, 1), diaInteiro: true }];
  }

  const resultado: Ocorrencia[] = [];
  const horaFim = periodo.horaFim ?? periodo.horaInicio;
  const comeco = Math.max(primeiro, janelaInicio);
  const termino = Math.min(ultimo, janelaFim - 1);
  for (let dia = comeco; dia <= termino; dia++) {
    if (!ocorreNoDia(periodo.periodicidade, dia, primeiro)) continue;
    const iso = numeroParaDia(dia);
    resultado.push(
      comHorario
        ? { inicio: `${iso}T${periodo.horaInicio}`, fim: `${iso}T${horaFim}`, diaInteiro: false }
        : { inicio: iso, fim: iso, diaInteiro: true },
    );
  }
  return resultado;
}
