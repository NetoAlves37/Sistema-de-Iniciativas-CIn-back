import type { Clock } from '@/shared/domain/clock';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { AlterarIniciativa } from './alterar-iniciativa';

/** RN-04. */
export class EditarIniciativa {
  constructor(
    private readonly alterar: AlterarIniciativa,
    private readonly clock: Clock,
  ) {}

  async executar(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    const dados = DadosIniciativa.criar(entrada);
    await this.alterar.executar(id, (iniciativa) =>
      iniciativa.editar(dados, entrada.comVotacao ?? iniciativa.comVotacao, usuarioId, this.clock),
    );
  }
}
