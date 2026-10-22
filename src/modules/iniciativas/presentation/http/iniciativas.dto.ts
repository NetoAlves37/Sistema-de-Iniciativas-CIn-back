import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { STATUS_INICIATIVA } from '../../domain/status';
import { PERIODICIDADES, TIPOS_INICIATIVA } from '../../domain/tipos';

/**
 * Corpo de `POST /iniciativas`, `PATCH /iniciativas/:id` e `POST /iniciativas/:id/ressubmissao`.
 *
 * O schema só garante os TIPOS; as regras de RN-01 e RN-02 (obrigatoriedade, limites, datas e
 * horários) vivem no domínio (`DadosIniciativa`), que acumula as mensagens por campo e as
 * devolve num 422 com `errors`. Por isso os campos são opcionais aqui.
 */
export const DadosIniciativaSchema = z.object({
  tipo: z
    .string()
    .optional()
    .describe(`Tipo: ${TIPOS_INICIATIVA.join(', ')}`),
  titulo: z.string().optional().describe('Título (até 120 caracteres)'),
  resumo: z.string().optional().describe('Descrição resumida (até 280 caracteres)'),
  detalhe: z.string().optional().describe('Descrição detalhada (até 5000 caracteres)'),
  inicio: z.string().optional().describe('Data de início (YYYY-MM-DD)'),
  fim: z.string().optional().describe('Data de término (YYYY-MM-DD), igual ou posterior ao início'),
  horaInicio: z
    .string()
    .nullable()
    .optional()
    .describe('Hora de início (HH:mm), junto com horaFim'),
  horaFim: z
    .string()
    .nullable()
    .optional()
    .describe('Hora de término (HH:mm), posterior ao início'),
  periodicidade: z
    .string()
    .optional()
    .describe(`Periodicidade: ${PERIODICIDADES.join(', ')}`),
  espaco: z.string().optional().describe('Espaço utilizado (até 200 caracteres)'),
  organizadores: z.string().optional().describe('Organizadores, separados por vírgula (até 500)'),
  membros: z.string().nullable().optional().describe('Membros (opcional, até 500)'),
  participantes: z.number().optional().describe('Quantidade de participantes (1 a 100000)'),
  comVotacao: z.boolean().optional().describe('Enviar para votação geral (padrão: true)'),
});

export class DadosIniciativaDto extends createZodDto(DadosIniciativaSchema) {}

const ListagemBase = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

export const ListagemQuerySchema = ListagemBase.extend({
  status: z.enum(STATUS_INICIATIVA).optional().describe('Filtro por status'),
  tipo: z.enum(TIPOS_INICIATIVA).optional().describe('Filtro por tipo'),
  q: z.string().optional().describe('Busca em título, resumo, organizadores e espaço'),
  ordenar: z
    .enum(['relevancia', 'prazo', 'recentes', 'inicio'])
    .optional()
    .describe('Ordenação (padrão: recentes)'),
});

export class ListagemQueryDto extends createZodDto(ListagemQuerySchema) {}

export const MinhasQuerySchema = ListagemBase.extend({
  status: z.enum(STATUS_INICIATIVA).optional().describe('Filtro por status'),
});

export class MinhasQueryDto extends createZodDto(MinhasQuerySchema) {}

/** Resposta documentada no Swagger (a forma exata está em `application/dto/iniciativa.dto.ts`). */
export const IdParamSchema = z.object({ id: z.string().uuid() });
