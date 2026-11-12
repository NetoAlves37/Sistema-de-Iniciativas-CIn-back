import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import type { OcorrenciaCalendario, ResumoIniciativa } from '../../application/dto/divulgacao.dto';
import { ListarAprovadas } from '../../application/queries/listar-aprovadas';
import { ListarOcorrencias } from '../../application/queries/listar-ocorrencias';
import { AprovadasQueryDto, OcorrenciasQueryDto } from './divulgacao.dto';

@ApiTags('Divulgação')
@ApiBearerAuth()
@Controller({ path: 'divulgacao', version: '1' })
export class DivulgacaoController {
  constructor(
    @Inject(ListarAprovadas) private readonly listarAprovadas: ListarAprovadas,
    @Inject(ListarOcorrencias) private readonly listarOcorrencias: ListarOcorrencias,
  ) {}

  @Get('aprovadas')
  @ApiOperation({
    summary: 'Lista as iniciativas aprovadas',
    description: 'Visível a qualquer usuário autenticado. Ordenada pela data de início.',
  })
  @ApiResponse({ status: 200, description: 'Página de resumos de iniciativas aprovadas' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Sem permissão de acesso' })
  @ApiResponse({ status: 422, description: 'Filtros ou paginação inválidos' })
  async aprovadas(
    @Query() query: AprovadasQueryDto,
  ): Promise<PaginatedResponseDto<ResumoIniciativa>> {
    const pagina = await this.listarAprovadas.executar({
      q: query.q,
      tipo: query.tipo,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: pagina.items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: pagina.total,
        totalPages: Math.ceil(pagina.total / query.limit),
      },
    };
  }

  @Get('ocorrencias')
  @ApiOperation({
    summary: 'Ocorrências das aprovadas no calendário',
    description:
      'Intervalo `[de, ate)` de no máximo 62 dias. `inicio` e `fim` são `YYYY-MM-DD` (dia inteiro; `fim` exclusivo no Evento único) ou `YYYY-MM-DDTHH:mm`.',
  })
  @ApiResponse({ status: 200, description: 'Lista de ocorrências em ordem cronológica' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Sem permissão de acesso' })
  @ApiResponse({ status: 422, description: 'Datas inválidas ou intervalo maior que 62 dias' })
  ocorrencias(
    @GetCurrentUser() user: CurrentUser,
    @Query() query: OcorrenciasQueryDto,
  ): Promise<OcorrenciaCalendario[]> {
    return this.listarOcorrencias.executar({
      de: query.de,
      ate: query.ate,
      tipos: query.tipos,
      minhas: query.minhas,
      usuarioId: user.userId,
    });
  }
}
