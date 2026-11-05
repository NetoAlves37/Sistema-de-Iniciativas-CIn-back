import { ValidacaoError } from '@/shared/domain/domain-error';
import { diaParaNumero } from './datas';

/** RN-12.4: o calendário consulta no máximo 62 dias por vez. */
export const MAXIMO_DIAS_INTERVALO = 62;

/** Valida o intervalo `[de, ate)` (datas `YYYY-MM-DD`) do calendário. */
export function validarIntervalo(de: string, ate: string): void {
  const inicio = diaParaNumero(de);
  const fim = diaParaNumero(ate);
  const erros: Record<string, string> = {};
  if (inicio === null) erros.de = 'Informe uma data inicial válida (AAAA-MM-DD).';
  if (fim === null) erros.ate = 'Informe uma data final válida (AAAA-MM-DD).';
  if (Object.keys(erros).length > 0) throw new ValidacaoError(erros);
  const dias = (fim as number) - (inicio as number);
  if (dias <= 0) {
    throw new ValidacaoError({ ate: 'A data final deve ser posterior à data inicial.' });
  }
  if (dias > MAXIMO_DIAS_INTERVALO) {
    throw new ValidacaoError({
      ate: `O intervalo deve ter no máximo ${MAXIMO_DIAS_INTERVALO} dias.`,
    });
  }
}
