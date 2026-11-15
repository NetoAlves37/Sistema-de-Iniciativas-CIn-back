import type { Clock } from '@/shared/domain/clock';
import type { TipoRepository } from '../../domain/ports/tipo.repository';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { AlterarIniciativa } from './alterar-iniciativa';

/** RN-04. */
export class EditarIniciativa {
  constructor(
    private readonly alterar: AlterarIniciativa,
    private readonly clock: Clock,
    private readonly tipos: Pick<TipoRepository, 'codigosAtivos'>,
  ) {}

  async executar(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    const ativos = await this.tipos.codigosAtivos();
    await this.alterar.executar(id, (iniciativa) => {
      // O tipo atual continua valendo mesmo que tenha sido desativado depois da submissão.
      const permitidos = new Set([...ativos, iniciativa.dados.tipo]);
      const dados = DadosIniciativa.criar(entrada, permitidos);
      iniciativa.editar(dados, entrada.comVotacao ?? iniciativa.comVotacao, usuarioId, this.clock);
    });
  }
}
