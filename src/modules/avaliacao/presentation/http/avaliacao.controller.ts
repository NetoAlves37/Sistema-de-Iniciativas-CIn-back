import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessRole } from '@/common/auth/access-role.enum';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { Roles } from '@/common/auth/decorators/roles.decorator';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import type { DetalheIniciativa, ItemFila } from '../../application/dto/avaliacao.dto';
import { ObterFila } from '../../application/queries/obter-fila';
import { RegistrarDecisao } from '../../application/use-cases/registrar-decisao';
import { RegistrarDecisaoDto } from './avaliacao.dto';

@ApiTags('Avaliação')
@ApiBearerAuth()
@Roles(AccessRole.COMITE, AccessRole.ADMIN)
@Controller({ path: 'avaliacao', version: '1' })
export class AvaliacaoController {
  constructor(
    @Inject(ObterFila) private readonly obterFila: ObterFila,
    @Inject(RegistrarDecisao) private readonly registrarDecisao: RegistrarDecisao,
  ) {}

  @Get('fila')
  @ApiOperation({
    summary: 'Fila de análise do comitê',
    description:
      'Iniciativas em Em análise, ordenadas por relevância. `souAutor` indica as do próprio usuário.',
  })
  @ApiResponse({ status: 200, description: 'Página de resumos com `souAutor`' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'O usuário não é do comitê nem administrador' })
  @ApiResponse({ status: 422, description: 'Parâmetros de paginação inválidos' })
  async fila(
    @GetCurrentUser() user: CurrentUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ItemFila>> {
    const pagina = await this.obterFila.executar({
      usuarioId: user.userId,
      page: query.page,
      limit: query.limit,
    });
    return PaginatedResponseDto.of(pagina.items, pagina.total, query);
  }

  @Post(':id/decisao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registra a decisão do comitê (aprovar ou reprovar)',
    description:
      'Só em Em análise. O autor não decide a própria iniciativa. A reprovação exige justificativa.',
  })
  @ApiResponse({ status: 200, description: 'Detalhe da iniciativa atualizado' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({
    status: 403,
    description: 'Sem perfil de comitê, ou o usuário é o autor da iniciativa',
  })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  @ApiResponse({
    status: 409,
    description: 'A iniciativa não está em análise ou já foi decidida',
  })
  @ApiResponse({ status: 422, description: 'Resultado inválido ou justificativa ausente' })
  decidir(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RegistrarDecisaoDto,
  ): Promise<DetalheIniciativa> {
    return this.registrarDecisao.executar({
      iniciativaId: id,
      resultado: body.resultado,
      justificativa: body.justificativa,
      decisor: { id: user.userId, nome: user.nome },
    });
  }
}
