import { ValidacaoError } from '@/shared/domain/domain-error';

export const RESULTADOS_DECISAO = ['APROVADA', 'REPROVADA'] as const;
export type ResultadoDecisao = (typeof RESULTADOS_DECISAO)[number];

export const LIMITE_JUSTIFICATIVA = 2000;

export interface DecisaoValidada {
  resultado: ResultadoDecisao;
  /** `null` na aprovação; na reprovação, o texto sem espaços nas pontas (1 a 2000 caracteres). */
  justificativa: string | null;
}

/**
 * Valida a entrada da decisão do comitê (RN-10): a justificativa é obrigatória na
 * reprovação (1 a 2000 caracteres após o trim) e ignorada na aprovação.
 */
export function validarDecisao(
  resultado: string,
  justificativa: string | null | undefined,
): DecisaoValidada {
  if (resultado === 'APROVADA') return { resultado, justificativa: null };
  if (resultado !== 'REPROVADA') {
    throw new ValidacaoError({ resultado: 'Informe se a iniciativa foi aprovada ou reprovada.' });
  }
  const texto = (justificativa ?? '').trim();
  if (texto.length === 0) {
    throw new ValidacaoError({ justificativa: 'A justificativa é obrigatória para reprovar.' });
  }
  if (texto.length > LIMITE_JUSTIFICATIVA) {
    throw new ValidacaoError({
      justificativa: `A justificativa deve ter no máximo ${LIMITE_JUSTIFICATIVA} caracteres.`,
    });
  }
  return { resultado, justificativa: texto };
}
