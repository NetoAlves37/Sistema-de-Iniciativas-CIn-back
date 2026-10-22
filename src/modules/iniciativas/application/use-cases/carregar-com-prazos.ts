import type { Clock } from '@/shared/domain/clock';
import { ConcorrenciaError } from '../../domain/errors/iniciativas.errors';
import type { Iniciativa } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { PrazosConfig } from '../../domain/ports/prazos-config';
import type { EventosPort } from '../ports/eventos.port';
import type { TransacaoPort } from '../ports/transacao.port';

const TENTATIVAS = 3;

/**
 * Carrega uma iniciativa aplicando antes as transições por prazo vencidas (RN-06). É o
 * ponto único usado por todo caso de uso que depende de status (editar, comentar, votar,
 * decidir, ler detalhe): o resultado não depende do intervalo do job.
 *
 * A aplicação roda numa transação PRÓPRIA e confirmada, antes da operação que a pediu. Assim,
 * se a operação falhar (por exemplo, editar depois do prazo → 409), a transição já ficou
 * gravada (RN-04.4). Se outra instância gravar ao mesmo tempo, relê e tenta de novo.
 */
export class CarregarComPrazos {
  constructor(
    private readonly repositorio: IniciativaRepository,
    private readonly transacao: TransacaoPort,
    private readonly eventos: EventosPort,
    private readonly clock: Clock,
    private readonly prazos: PrazosConfig,
  ) {}

  async executar(id: string): Promise<Iniciativa | null> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        const iniciativa = await this.transacao.run(async () => {
          const carregada = await this.repositorio.buscarPorId(id);
          if (!carregada) return null;
          const transicoes = carregada.aplicarPrazosVencidos(this.clock, this.prazos);
          if (transicoes.length > 0) await this.repositorio.salvar(carregada);
          return carregada;
        });
        if (iniciativa) this.eventos.publicar(iniciativa.pullEvents());
        return iniciativa;
      } catch (erro) {
        if (erro instanceof ConcorrenciaError && tentativa < TENTATIVAS) continue;
        throw erro;
      }
    }
  }
}
