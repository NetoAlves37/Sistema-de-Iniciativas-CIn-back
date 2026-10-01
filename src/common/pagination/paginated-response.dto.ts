import { ApiProperty } from '@nestjs/swagger';
import type { PaginationQueryDto } from './pagination-query.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Página atual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Itens por página' })
  limit: number;

  @ApiProperty({ example: 150, description: 'Total de itens' })
  total: number;

  @ApiProperty({ example: 8, description: 'Total de páginas' })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ type: 'array', description: 'Lista de itens' })
  items: T[];

  @ApiProperty({ description: 'Metadados de paginação' })
  meta: PaginationMetaDto;

  static of<T>(items: T[], total: number, query: PaginationQueryDto): PaginatedResponseDto<T> {
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
