import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MENSAGEM_VALOR = 'O voto deve ser 1 (curtir) ou -1 (não curtir).';

export const RegistrarVotoSchema = z.object({
  valor: z
    .union([z.literal(1), z.literal(-1)], {
      errorMap: () => ({ message: MENSAGEM_VALOR }),
    })
    .describe('1 (curtir) ou -1 (não curtir)'),
});

export class RegistrarVotoDto extends createZodDto(RegistrarVotoSchema) {}

export const ResultadoVotoResponseSchema = z.object({
  meuVoto: z
    .union([z.literal(1), z.literal(-1), z.literal(0)])
    .describe('Voto atual; 0 = sem voto'),
  likes: z.number().int(),
  dislikes: z.number().int(),
  relevancia: z.number().describe('Limite inferior de Wilson (0 a 1) do ciclo atual'),
  acao: z.enum(['REGISTRADO', 'ALTERADO', 'RETIRADO']),
});

export class ResultadoVotoResponseDto extends createZodDto(ResultadoVotoResponseSchema) {}
