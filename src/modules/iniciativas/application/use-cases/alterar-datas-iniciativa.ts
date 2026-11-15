import type { Clock } from '@/shared/domain/clock';
import type { AtorDto, DatasIniciativaInput } from '../dto/iniciativa.dto';
import type { AlterarIniciativa } from './alterar-iniciativa';

/** Comitê ou ADMIN altera datas e horários de uma aprovada (a série inteira). */
export class AlterarDatasIniciativa {
  constructor(
    private readonly alterar: AlterarIniciativa,
    private readonly clock: Clock,
  ) {}

  async executar(id: string, ator: AtorDto, datas: DatasIniciativaInput): Promise<void> {
    await this.alterar.executar(id, (iniciativa) =>
      iniciativa.alterarDatas(datas, { id: ator.id, ehComite: ator.ehComite }, this.clock),
    );
  }
}
