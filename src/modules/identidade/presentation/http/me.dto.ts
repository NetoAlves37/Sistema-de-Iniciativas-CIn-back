import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PERFIS } from '../../domain/perfil';

export const MeResponseSchema = z.object({
  id: z.string().describe('Identificador do usuário (sub do token)'),
  nome: z.string().describe('Nome para exibição'),
  perfil: z.enum(PERFIS).describe('Perfil de exibição: ALUNO, PROFESSOR, COMITE ou ADMIN'),
  ehComite: z
    .boolean()
    .describe('Pode ver a fila de análise e decidir (membro do comitê ou administrador)'),
  prazos: z
    .object({
      refinamentoDias: z.number().describe('Dias de refinamento (sugestões)'),
      votacaoDias: z.number().describe('Dias de votação'),
    })
    .describe('Prazos configurados, usados nos textos da tela'),
});

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
