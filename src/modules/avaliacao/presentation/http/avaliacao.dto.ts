import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { LIMITE_JUSTIFICATIVA, RESULTADOS_DECISAO } from '../../domain/decisao';

export const RegistrarDecisaoSchema = z.object({
  resultado: z.enum(RESULTADOS_DECISAO).describe('APROVADA ou REPROVADA'),
  justificativa: z
    .string()
    .nullish()
    .describe(
      `Obrigatória na reprovação (1 a ${LIMITE_JUSTIFICATIVA} caracteres); ignorada na aprovação`,
    ),
});

export class RegistrarDecisaoDto extends createZodDto(RegistrarDecisaoSchema) {}
