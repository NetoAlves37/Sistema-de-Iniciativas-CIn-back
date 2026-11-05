import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessRole } from '@/common/auth/access-role.enum';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import type { AtorDto, DadosIniciativaInput } from '../../application/dto/iniciativa.dto';
import { IniciativasFacade } from '../../application/iniciativas.facade';
import { DadosIniciativaDto, ListagemQueryDto, MinhasQueryDto } from './iniciativas.dto';

function atorDe(user: CurrentUser): AtorDto {
  return {
    id: user.userId,
    nome: user.nome,
    ehComite: user.roles.includes(AccessRole.COMITE) || user.roles.includes(AccessRole.ADMIN),
  };
}

function pagina<T>(items: T[], total: number, page: number, limit: number) {
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

@ApiTags('Iniciativas')
@ApiBearerAuth()
@Controller({ path: 'iniciativas', version: '1' })
export class IniciativasController {
  constructor(private readonly iniciativas: IniciativasFacade) {}

  @Post()
  @ApiOperation({ summary: 'Submeter uma iniciativa (abre o refinamento)' })
  @ApiResponse({ status: 201, description: 'Iniciativa criada em Em andamento (detalhe)' })
  @ApiResponse({
    status: 422,
    description: 'Campos inválidos (RN-01 e RN-02), com `errors` por campo',
  })
  async submeter(@Body() corpo: DadosIniciativaDto, @GetCurrentUser() user: CurrentUser) {
    const id = await this.iniciativas.submeter(user.userId, corpo as DadosIniciativaInput);
    return this.iniciativas.detalhe(id, atorDe(user));
  }

  @Get()
  @ApiOperation({
    summary: 'Listar iniciativas (filtros, ordenação e paginação no servidor)',
    description:
      'Ex.: `status=EM_VOTACAO&ordenar=relevancia` (início) e `status=EM_ANDAMENTO&ordenar=prazo`.',
  })
  @ApiResponse({ status: 200, description: 'Página de resumos de iniciativas' })
  async listar(@Query() query: ListagemQueryDto) {
    const { items, total } = await this.iniciativas.listar({
      status: query.status,
      tipo: query.tipo,
      q: query.q,
      ordenar: query.ordenar,
      page: query.page,
      limit: query.limit,
    });
    return pagina(items, total, query.page, query.limit);
  }

  // Rotas estáticas ANTES de `:id`, senão `minhas` e `contagens` seriam lidas como ids.

  @Get('minhas')
  @ApiOperation({ summary: 'Minhas iniciativas, com a contagem por status' })
  @ApiResponse({ status: 200, description: 'Página de resumos e `meta.contagemPorStatus`' })
  async minhas(@Query() query: MinhasQueryDto, @GetCurrentUser() user: CurrentUser) {
    const resultado = await this.iniciativas.minhas(user.userId, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    const base = pagina(resultado.items, resultado.total, query.page, query.limit);
    return { ...base, meta: { ...base.meta, contagemPorStatus: resultado.contagemPorStatus } };
  }

  @Get('contagens')
  @ApiOperation({ summary: 'Contagens para o menu (iniciativas em análise)' })
  @ApiResponse({ status: 200, description: '`{ emAnalise }`' })
  contagens() {
    return this.iniciativas.contagens();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da iniciativa, com permissões calculadas para o usuário' })
  @ApiResponse({ status: 200, description: 'Detalhe (inclui `permissoes`, `meuVoto` e `decisao`)' })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  detalhe(@Param('id', ParseUUIDPipe) id: string, @GetCurrentUser() user: CurrentUser) {
    return this.iniciativas.detalhe(id, atorDe(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar a própria iniciativa (só em Em andamento)' })
  @ApiResponse({ status: 200, description: 'Detalhe atualizado' })
  @ApiResponse({ status: 403, description: 'Só o autor edita' })
  @ApiResponse({ status: 409, description: 'Status não permite edição' })
  @ApiResponse({ status: 422, description: 'Campos inválidos' })
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() corpo: DadosIniciativaDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    await this.iniciativas.editar(id, user.userId, corpo as DadosIniciativaInput);
    return this.iniciativas.detalhe(id, atorDe(user));
  }

  @Post(':id/ressubmissao')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ressubmeter uma iniciativa reprovada (novo ciclo)' })
  @ApiResponse({ status: 200, description: 'Detalhe no ciclo seguinte, em Em andamento' })
  @ApiResponse({ status: 403, description: 'Só o autor ressubmete' })
  @ApiResponse({ status: 409, description: 'Só iniciativas reprovadas' })
  @ApiResponse({ status: 422, description: 'Campos inválidos' })
  async ressubmeter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() corpo: DadosIniciativaDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    await this.iniciativas.ressubmeter(id, user.userId, corpo as DadosIniciativaInput);
    return this.iniciativas.detalhe(id, atorDe(user));
  }

  @Get(':id/historico')
  @ApiOperation({ summary: 'Histórico de transições de status (mais recente primeiro)' })
  @ApiResponse({ status: 200, description: 'Lista de transições' })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  historico(@Param('id', ParseUUIDPipe) id: string) {
    return this.iniciativas.historico(id);
  }
}
