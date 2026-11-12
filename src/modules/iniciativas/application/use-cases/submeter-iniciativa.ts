import type { Clock } from '@/shared/domain/clock';
import { Iniciativa } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { PrazosConfig } from '../../domain/ports/prazos-config';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { EventosPort } from '../ports/eventos.port';
import type { TransacaoPort } from '../ports/transacao.port';

/** RN-01 a RN-03. */
export class SubmeterIniciativa {
  constructor(
    private readonly repositorio: IniciativaRepository,
    private readonly transacao: TransacaoPort,
    private readonly eventos: EventosPort,
    private readonly clock: Clock,
    private readonly prazos: PrazosConfig,
  ) {}

  /** Devolve o id da iniciativa criada. */
  async executar(autorId: string, entrada: DadosIniciativaInput): Promise<string> {
    const dados = DadosIniciativa.criar(entrada);
    const iniciativa = Iniciativa.submeter(
      dados,
      autorId,
      entrada.comVotacao ?? true,
      this.clock,
      this.prazos,
    );
    await this.transacao.run(() => this.repositorio.criar(iniciativa));
    this.eventos.publicar(iniciativa.pullEvents());
    return iniciativa.id;
  }
}
