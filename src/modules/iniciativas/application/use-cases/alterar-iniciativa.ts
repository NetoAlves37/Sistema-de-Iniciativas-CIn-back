import type { TransacaoPort } from '@/shared/domain/transacao.port';
import { IniciativaNaoEncontradaError } from '../../domain/errors/iniciativas.errors';
import type { Iniciativa } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { EventosPort } from '../ports/eventos.port';
import type { CarregarComPrazos } from './carregar-com-prazos';

/**
 * Passo comum dos casos de uso que alteram uma iniciativa existente (editar, ressubmeter e
 * decidir): carrega aplicando prazos, executa a mudança e grava em transação, publicando os
 * eventos.
 */
export class AlterarIniciativa {
  constructor(
    private readonly repositorio: IniciativaRepository,
    private readonly transacao: TransacaoPort,
    private readonly eventos: EventosPort,
    private readonly carregar: CarregarComPrazos,
  ) {}

  async executar(id: string, mudar: (iniciativa: Iniciativa) => void): Promise<void> {
    const iniciativa = await this.carregar.executar(id);
    if (!iniciativa) throw new IniciativaNaoEncontradaError();
    mudar(iniciativa);
    await this.transacao.run(() => this.repositorio.salvar(iniciativa));
    this.eventos.publicar(iniciativa.pullEvents());
  }
}
