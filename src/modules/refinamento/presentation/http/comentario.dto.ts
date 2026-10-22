import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MENSAGEM_TEXTO = 'Escreva sua sugestão antes de enviar.';

export const CriarComentarioSchema = z.object({
  texto: z
    .string({ required_error: MENSAGEM_TEXTO, invalid_type_error: MENSAGEM_TEXTO })
    .describe('Texto da sugestão (1 a 1000 caracteres após remover espaços nas pontas)'),
});

export class CriarComentarioDto extends createZodDto(CriarComentarioSchema) {}

export const ListarComentariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export class ListarComentariosQueryDto extends createZodDto(ListarComentariosQuerySchema) {}

export const ComentarioResponseSchema = z.object({
  id: z.string().uuid(),
  ciclo: z.number().int().describe('Ciclo da iniciativa em que o comentário foi feito'),
  autor: z.object({
    id: z.string(),
    nome: z.string(),
    perfil: z.enum(['ALUNO', 'PROFESSOR', 'COMITE', 'ADMIN']),
    ehAutorDaIniciativa: z.boolean(),
  }),
  texto: z.string(),
  criadoEm: z.string().describe('Data e hora em ISO 8601'),
});

export class ComentarioResponseDto extends createZodDto(ComentarioResponseSchema) {}

export const PaginaDeComentariosResponseSchema = z.object({
  items: z.array(ComentarioResponseSchema),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export class PaginaDeComentariosResponseDto extends createZodDto(
  PaginaDeComentariosResponseSchema,
) {}
