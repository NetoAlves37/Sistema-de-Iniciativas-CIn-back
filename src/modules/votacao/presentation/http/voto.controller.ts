import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { VotacaoFacade } from '../../application/votacao.facade';
import { RegistrarVotoDto, ResultadoVotoResponseDto } from './voto.dto';

@ApiTags('Votação')
@ApiBearerAuth()
@Controller({ path: 'iniciativas/:id/voto', version: '1' })
export class VotoController {
  constructor(private readonly votacao: VotacaoFacade) {}

  @Put()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registra, troca ou retira o voto do usuário',
    description:
      'Mesmo valor que o usuário já tem retira o voto; valor oposto troca. Só em Em votação.',
  })
  @ApiResponse({ status: 200, type: ResultadoVotoResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Iniciativa não encontrada' })
  @ApiResponse({ status: 409, description: 'A votação desta iniciativa foi encerrada' })
  @ApiResponse({ status: 422, description: 'Valor do voto inválido' })
  votar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RegistrarVotoDto,
    @GetCurrentUser() user: CurrentUser,
  ): Promise<ResultadoVotoResponseDto> {
    return this.votacao.votar({ iniciativaId: id, usuarioId: user.userId, valor: body.valor });
  }
}
