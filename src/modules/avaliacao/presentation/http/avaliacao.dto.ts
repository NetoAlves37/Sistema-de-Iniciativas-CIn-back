import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RESULTADOS_DECISAO } from '../../domain/decisao';

export const RegistrarDecisaoSchema = z.object({
  resultado: z.enum(RESULTADOS_DECISAO).describe('APROVADA ou REPROVADA'),
  justificativa: z
    .string()
    .nullish()
    .describe('Obrigatória na reprovação (1 a 2000 caracteres); ignorada na aprovação'),
});

export class RegistrarDecisaoDto extends createZodDto(RegistrarDecisaoSchema) {}
