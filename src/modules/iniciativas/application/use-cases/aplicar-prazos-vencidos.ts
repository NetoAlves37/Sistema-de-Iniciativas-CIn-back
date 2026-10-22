import type { Clock } from '@/shared/domain/clock';
import { ConcorrenciaError } from '../../domain/errors/iniciativas.errors';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { CarregarComPrazos } from './carregar-com-prazos';

const TAMANHO_DO_LOTE = 100;

/**
 * Job de transições (RN-06): busca as iniciativas com prazo vencido, em lotes de 100, e
 * aplica as transições de cada uma. Idempotente e seguro com várias instâncias: o
 * `ConcorrenciaError` de quem perdeu a corrida é ignorado, porque outra instância já
 * processou aquela iniciativa.
 */
export class AplicarPrazosVencidos {
  constructor(
    private readonly repositorio: IniciativaRepository,
    private readonly carregar: CarregarComPrazos,
    private readonly clock: Clock,
  ) {}

  /** Devolve quantas iniciativas foram processadas. */
  async executar(): Promise<number> {
    let processadas = 0;
    const jaVistas = new Set<string>();
    for (;;) {
      const ids = (
        await this.repositorio.idsComPrazoVencido(this.clock.now(), TAMANHO_DO_LOTE)
      ).filter((id) => !jaVistas.has(id));
      if (ids.length === 0) return processadas;
      for (const id of ids) {
        jaVistas.add(id);
        try {
          await this.carregar.executar(id);
          processadas++;
        } catch (erro) {
          if (!(erro instanceof ConcorrenciaError)) throw erro;
        }
      }
    }
  }
}
