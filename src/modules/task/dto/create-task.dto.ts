import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TASK_PRIORITY_CODES, TASK_STATUS_CODES } from '../task.constants';

export const CreateTaskSchema = z.object({
  title: z.string().min(3).max(200).describe('Título da tarefa'),
  description: z.string().optional().describe('Descrição detalhada'),
  priority: z.enum(TASK_PRIORITY_CODES).optional().describe('Prioridade da tarefa'),
  status: z.enum(TASK_STATUS_CODES).optional().describe('Status da tarefa'),
  dueDate: z.string().date().optional().describe('Data de vencimento (YYYY-MM-DD)'),
});

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}
