/**
 * Aritmética de datas `YYYY-MM-DD` em UTC, sem depender do fuso da máquina: a data é
 * tratada como um número de dias desde 1970-01-01.
 */
const MS_POR_DIA = 86_400_000;
const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Converte `YYYY-MM-DD` em dias desde a época, ou `null` se não for uma data de calendário válida. */
export function diaParaNumero(dia: string): number | null {
  const partes = FORMATO_DIA.exec(dia);
  if (!partes) return null;
  const [ano, mes, diaDoMes] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const ms = Date.UTC(ano, mes - 1, diaDoMes);
  const data = new Date(ms);
  const confere =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === diaDoMes;
  return confere ? ms / MS_POR_DIA : null;
}

/** Converte dias desde a época em `YYYY-MM-DD`. */
export function numeroParaDia(numero: number): string {
  const data = new Date(numero * MS_POR_DIA);
  const ano = String(data.getUTCFullYear()).padStart(4, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const diaDoMes = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${diaDoMes}`;
}

/** Soma `n` dias (pode ser negativo) a uma data `YYYY-MM-DD` válida. */
export function somarDias(dia: string, n: number): string {
  const numero = diaParaNumero(dia);
  if (numero === null) throw new RangeError(`Data inválida: ${dia}`);
  return numeroParaDia(numero + n);
}

/** Dia do mês (1 a 31) de um número de dias. */
export function diaDoMes(numero: number): number {
  return new Date(numero * MS_POR_DIA).getUTCDate();
}

/** Quantos dias tem o mês em que cai o número de dias. */
export function diasNoMes(numero: number): number {
  const data = new Date(numero * MS_POR_DIA);
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
}
