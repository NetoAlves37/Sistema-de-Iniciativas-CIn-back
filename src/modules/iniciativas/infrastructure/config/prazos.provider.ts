import type { ConfigService } from '@nestjs/config';
import type { PrazosConfig } from '../../domain/ports/prazos-config';

/** Lê os prazos (`PRAZO_REFINAMENTO_DIAS` e `PRAZO_VOTACAO_DIAS`) da configuração. */
export function prazosDaConfiguracao(config: ConfigService): PrazosConfig {
  return {
    refinamentoDias: config.getOrThrow<number>('prazos.refinamentoDias'),
    votacaoDias: config.getOrThrow<number>('prazos.votacaoDias'),
  };
}
