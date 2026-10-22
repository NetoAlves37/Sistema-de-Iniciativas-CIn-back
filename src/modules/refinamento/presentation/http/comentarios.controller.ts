import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { RefinamentoFacade } from '../../application/refinamento.facade';
import {
  ComentarioResponseDto,
  CriarComentarioDto,
  ListarComentariosQueryDto,
  PaginaDeComentariosResponseDto,
} from './comentario.dto';

@ApiTags('Refinamento')
@ApiBearerAuth()
@Controller({ path: 'iniciativas/:id/comentarios', version: '1' })
export class ComentariosController {
  constructor(private readonly refinamento: RefinamentoFacade) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os comentários da iniciativa',
    description:
      'Ciclo mais recente primeiro e, dentro do ciclo, do mais antigo para o mais novo. Limite padrão: 50.',
  })
  @ApiResponse({ status: 200, type: PaginaDeComentariosResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  @ApiResponse({ status: 422, description: 'Parâmetros de paginação inválidos' })
  listar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListarComentariosQueryDto,
  ): Promise<PaginaDeComentariosResponseDto> {
    return this.refinamento.listar({ iniciativaId: id, page: query.page, limit: query.limit });
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Comenta (sugere) na iniciativa',
    description: 'Só enquanto a iniciativa está Em andamento. Qualquer usuário, inclusive o autor.',
  })
  @ApiResponse({ status: 201, type: ComentarioResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  @ApiResponse({ status: 409, description: 'A fase de sugestões terminou' })
  @ApiResponse({ status: 422, description: 'Texto vazio ou com mais de 1000 caracteres' })
  comentar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CriarComentarioDto,
    @GetCurrentUser() user: CurrentUser,
  ): Promise<ComentarioResponseDto> {
    return this.refinamento.comentar({
      iniciativaId: id,
      autorId: user.userId,
      texto: body.texto,
    });
  }
}
