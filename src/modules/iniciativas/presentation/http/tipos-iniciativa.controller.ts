import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessRole } from '@/common/auth/access-role.enum';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { Roles } from '@/common/auth/decorators/roles.decorator';
import type {
  AlterarTipoInput,
  AtorTipoDto,
  CadastrarTipoInput,
} from '../../application/dto/tipo.dto';
import {
  AlterarTipo,
  CadastrarTipo,
  ExcluirTipo,
  ListarTipos,
} from '../../application/use-cases/tipos-iniciativa';
import { AlterarTipoDto, CadastrarTipoDto, ListarTiposQueryDto } from './tipos-iniciativa.dto';

function atorDe(user: CurrentUser): AtorTipoDto {
  return {
    id: user.userId,
    nome: user.nome,
    ehComite: user.roles.includes(AccessRole.COMITE) || user.roles.includes(AccessRole.ADMIN),
  };
}

/**
 * Cadastro de tipos de iniciativa. Qualquer autenticado lista (o formulário e os filtros
 * precisam); só o comitê e o ADMIN cadastram, alteram e excluem. Toda mudança vai para o log
 * de auditoria (`iniciativas_tipos_log`).
 */
@ApiTags('Tipos de iniciativa')
@ApiBearerAuth()
@Controller({ path: 'tipos-iniciativa', version: '1' })
export class TiposIniciativaController {
  constructor(
    private readonly listarTipos: ListarTipos,
    private readonly cadastrarTipo: CadastrarTipo,
    private readonly alterarTipo: AlterarTipo,
    private readonly excluirTipo: ExcluirTipo,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar os tipos (ativos e inativos, ou só os ativos)' })
  @ApiResponse({
    status: 200,
    description: 'Tipos em ordem alfabética, com a contagem de iniciativas',
  })
  listar(@Query() query: ListarTiposQueryDto) {
    return this.listarTipos.executar({ somenteAtivos: query.ativos });
  }

  @Post()
  @Roles(AccessRole.COMITE, AccessRole.ADMIN)
  @ApiOperation({ summary: 'Cadastrar um tipo (comitê ou ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tipo criado (ativo)' })
  @ApiResponse({ status: 403, description: 'Só o comitê ou o ADMIN' })
  @ApiResponse({ status: 422, description: 'Nome ou cor inválidos, ou nome repetido' })
  cadastrar(@Body() corpo: CadastrarTipoDto, @GetCurrentUser() user: CurrentUser) {
    return this.cadastrarTipo.executar(atorDe(user), corpo as CadastrarTipoInput);
  }

  @Patch(':id')
  @Roles(AccessRole.COMITE, AccessRole.ADMIN)
  @ApiOperation({
    summary: 'Renomear, trocar a cor e/ou ativar e desativar um tipo (comitê ou ADMIN)',
    description: 'Vale mesmo com iniciativas associadas. O código do tipo não muda.',
  })
  @ApiResponse({ status: 200, description: 'Tipo atualizado' })
  @ApiResponse({ status: 403, description: 'Só o comitê ou o ADMIN' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  @ApiResponse({ status: 422, description: 'Nome ou cor inválidos, ou nome repetido' })
  alterar(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: AlterarTipoDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.alterarTipo.executar(id, atorDe(user), corpo as AlterarTipoInput);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(AccessRole.COMITE, AccessRole.ADMIN)
  @ApiOperation({ summary: 'Excluir um tipo sem iniciativas associadas (comitê ou ADMIN)' })
  @ApiResponse({ status: 204, description: 'Excluído' })
  @ApiResponse({ status: 403, description: 'Só o comitê ou o ADMIN' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  @ApiResponse({ status: 409, description: 'Há iniciativas associadas ao tipo' })
  async excluir(@Param('id', ParseIntPipe) id: number, @GetCurrentUser() user: CurrentUser) {
    await this.excluirTipo.executar(id, atorDe(user));
  }
}
