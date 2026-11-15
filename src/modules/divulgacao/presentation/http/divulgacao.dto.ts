import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationQuerySchema } from '@/common/pagination/pagination-query.dto';
import { FORMATO_CODIGO_TIPO } from '@/shared/domain/vocabulario-iniciativa';

const CODIGO_TIPO = z.string().regex(FORMATO_CODIGO_TIPO, 'Código de tipo inválido.');

export const AprovadasQuerySchema = PaginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .optional()
    .transform((q) => (q ? q : undefined))
    .describe('Busca em título, resumo, organizadores e espaço (sem diferenciar maiúsculas)'),
  tipo: CODIGO_TIPO.optional().describe('Código do tipo (GET /tipos-iniciativa), ex.: PALESTRA'),
});

export class AprovadasQueryDto extends createZodDto(AprovadasQuerySchema) {}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const OcorrenciasQuerySchema = z.object({
  de: z.string().regex(DATA, 'Informe a data no formato AAAA-MM-DD.').describe('Início, inclusivo'),
  ate: z
    .string()
    .regex(DATA, 'Informe a data no formato AAAA-MM-DD.')
    .describe('Fim, exclusivo (no máximo 62 dias depois de `de`)'),
  tipos: z
    .string()
    .optional()
    .transform((csv) =>
      csv
        ? csv
            .split(',')
            .map((tipo) => tipo.trim())
            .filter((tipo) => tipo !== '')
        : [],
    )
    .pipe(z.array(CODIGO_TIPO))
    .describe('Códigos de tipo separados por vírgulas (GET /tipos-iniciativa)'),
  minhas: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true')
    .describe('Só as iniciativas do usuário logado'),
});

export class OcorrenciasQueryDto extends createZodDto(OcorrenciasQuerySchema) {}
