import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/database/prisma.service';

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Verifica o status da aplicação e conexão com banco' })
  @ApiResponse({ status: 200, description: 'Aplicação saudável' })
  @ApiResponse({ status: 503, description: 'Serviço indisponível' })
  check() {
    return this.health.check([() => this.db.pingCheck('database', this.prisma)]);
  }
}
