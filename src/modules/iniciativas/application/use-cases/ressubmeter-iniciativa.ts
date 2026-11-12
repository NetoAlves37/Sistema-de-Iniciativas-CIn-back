import type { Clock } from '@/shared/domain/clock';
import type { PrazosConfig } from '../../domain/ports/prazos-config';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { AlterarIniciativa } from './alterar-iniciativa';

/** RN-11. */
export class RessubmeterIniciativa {
  constructor(
    private readonly alterar: AlterarIniciativa,
    private readonly clock: Clock,
    private readonly prazos: PrazosConfig,
  ) {}

  async executar(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    const dados = DadosIniciativa.criar(entrada);
    await this.alterar.executar(id, (iniciativa) =>
      iniciativa.ressubmeter(
        dados,
        entrada.comVotacao ?? iniciativa.comVotacao,
        usuarioId,
        this.clock,
        this.prazos,
      ),
    );
  }
}
