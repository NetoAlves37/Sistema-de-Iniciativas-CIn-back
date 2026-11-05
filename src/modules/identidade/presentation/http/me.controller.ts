import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessRole } from '@/common/auth/access-role.enum';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import { IdentidadeFacade } from '../../application/identidade.facade';
import { MeResponseDto } from './me.dto';

@ApiTags('Identidade')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly identidade: IdentidadeFacade,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Retorna o usuário autenticado, o perfil e os prazos configurados' })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@GetCurrentUser() user: CurrentUser): Promise<MeResponseDto> {
    const usuario = await this.identidade.obterPorId(user.userId);
    return {
      id: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil,
      ehComite: user.roles.includes(AccessRole.COMITE) || user.roles.includes(AccessRole.ADMIN),
      prazos: {
        refinamentoDias: this.config.getOrThrow<number>('prazos.refinamentoDias'),
        votacaoDias: this.config.getOrThrow<number>('prazos.votacaoDias'),
      },
    };
  }
}
