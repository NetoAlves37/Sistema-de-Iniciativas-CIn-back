import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Corpo de erro no formato RFC 7807 (Problem Details for HTTP APIs). */
export class ProblemDetails {
  @ApiProperty({ example: 'https://sistema-de-iniciativas-cin.example/problems/validation-failed' })
  type!: string;

  @ApiProperty({ example: 'Dados inválidos' })
  title!: string;

  @ApiProperty({ example: 422 })
  status!: number;

  @ApiProperty({ example: 'Um ou mais campos precisam ser corrigidos.' })
  detail!: string;

  @ApiProperty({ example: '/api/v1/tasks' })
  instance!: string;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({
    example: { title: ['O título deve ter no mínimo 3 caracteres.'] },
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  errors?: Record<string, string[]>;
}
