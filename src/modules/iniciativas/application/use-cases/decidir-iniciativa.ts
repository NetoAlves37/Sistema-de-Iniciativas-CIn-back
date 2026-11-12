import type { Clock } from '@/shared/domain/clock';
import { ConcorrenciaError } from '../../domain/errors/iniciativas.errors';
import type { AlterarIniciativa } from './alterar-iniciativa';

const MENSAGEM_JA_DECIDIDA = 'Esta iniciativa já foi decidida.';

/**
 * RN-10. A segunda decisão concorrente perde na checagem de versão e recebe 409
 * ("Esta iniciativa já foi decidida.").
 */
export class DecidirIniciativa {
  constructor(
    private readonly alterar: AlterarIniciativa,
    private readonly clock: Clock,
  ) {}

  async executar(
    id: string,
    decisorId: string,
    resultado: 'APROVADA' | 'REPROVADA',
    justificativa: string | null | undefined,
  ): Promise<void> {
    try {
      await this.alterar.executar(id, (iniciativa) =>
        iniciativa.decidir(resultado, justificativa ?? undefined, decisorId, this.clock),
      );
    } catch (erro) {
      if (erro instanceof ConcorrenciaError) throw new ConcorrenciaError(MENSAGEM_JA_DECIDIDA);
      throw erro;
    }
  }
}
