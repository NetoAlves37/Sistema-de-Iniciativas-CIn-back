import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { LIMITE_NOME_TIPO } from '../../domain/tipo-de-iniciativa';

/**
 * Corpos do cadastro de tipos. Como nos outros DTOs, o schema só garante os TIPOS; as regras
 * (obrigatório, tamanho, formato da cor, nome repetido) ficam no domínio e voltam num 422
 * com `errors` por campo.
 */
export const CadastrarTipoSchema = z.object({
  nome: z
    .string()
    .optional()
    .describe(`Nome do tipo (até ${LIMITE_NOME_TIPO} caracteres), por exemplo "Palestra"`),
  cor: z.string().optional().describe('Cor no formato #RRGGBB'),
});

export class CadastrarTipoDto extends createZodDto(CadastrarTipoSchema) {}

export const AlterarTipoSchema = z.object({
  nome: z.string().optional().describe('Novo nome (o código do tipo não muda)'),
  cor: z.string().optional().describe('Nova cor, #RRGGBB'),
  ativo: z.boolean().optional().describe('false desativa: some da seleção de novas iniciativas'),
});

export class AlterarTipoDto extends createZodDto(AlterarTipoSchema) {}

export const ListarTiposQuerySchema = z.object({
  ativos: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true')
    .describe('true: só os tipos ativos (os que podem ser escolhidos)'),
});

export class ListarTiposQueryDto extends createZodDto(ListarTiposQuerySchema) {}
