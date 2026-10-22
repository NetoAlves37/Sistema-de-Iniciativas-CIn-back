import type { Clock } from '@/shared/domain/clock';
import {
  ConcorrenciaError,
  IniciativaNaoEncontradaError,
} from '../../domain/errors/iniciativas.errors';
import { Iniciativa } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { PrazosConfig } from '../../domain/ports/prazos-config';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { EventosPort } from '../ports/eventos.port';
import type { TransacaoPort } from '../ports/transacao.port';
import type { CarregarComPrazos } from './carregar-com-prazos';

const MENSAGEM_JA_DECIDIDA = 'Esta iniciativa já foi decidida.';

interface DepsComando {
  repositorio: IniciativaRepository;
  transacao: TransacaoPort;
  eventos: EventosPort;
  clock: Clock;
  prazos: PrazosConfig;
  carregar: CarregarComPrazos;
}

/** Casos de uso que escrevem no agregado `Iniciativa`. */
export class ComandosIniciativa {
  constructor(private readonly deps: DepsComando) {}

  /** RN-01 a RN-03. Devolve o id da iniciativa criada. */
  async submeter(autorId: string, entrada: DadosIniciativaInput): Promise<string> {
    const { repositorio, transacao, eventos, clock, prazos } = this.deps;
    const dados = DadosIniciativa.criar(entrada);
    const iniciativa = Iniciativa.submeter(
      dados,
      autorId,
      entrada.comVotacao ?? true,
      clock,
      prazos,
    );
    await transacao.run(() => repositorio.criar(iniciativa));
    eventos.publicar(iniciativa.pullEvents());
    return iniciativa.id;
  }

  /** RN-04. */
  async editar(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    const { clock } = this.deps;
    const dados = DadosIniciativa.criar(entrada);
    await this.alterar(id, (iniciativa) =>
      iniciativa.editar(dados, entrada.comVotacao ?? iniciativa.comVotacao, usuarioId, clock),
    );
  }

  /** RN-11. */
  async ressubmeter(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    const { clock, prazos } = this.deps;
    const dados = DadosIniciativa.criar(entrada);
    await this.alterar(id, (iniciativa) =>
      iniciativa.ressubmeter(
        dados,
        entrada.comVotacao ?? iniciativa.comVotacao,
        usuarioId,
        clock,
        prazos,
      ),
    );
  }

  /**
   * RN-10. A segunda decisão concorrente perde na checagem de versão e recebe 409
   * ("Esta iniciativa já foi decidida.").
   */
  async decidir(
    id: string,
    decisorId: string,
    resultado: 'APROVADA' | 'REPROVADA',
    justificativa: string | null | undefined,
  ): Promise<void> {
    const { clock } = this.deps;
    try {
      await this.alterar(id, (iniciativa) =>
        iniciativa.decidir(resultado, justificativa ?? undefined, decisorId, clock),
      );
    } catch (erro) {
      if (erro instanceof ConcorrenciaError) throw new ConcorrenciaError(MENSAGEM_JA_DECIDIDA);
      throw erro;
    }
  }

  /** Carrega aplicando prazos, executa a mudança e grava em transação, publicando os eventos. */
  private async alterar(id: string, mudar: (iniciativa: Iniciativa) => void): Promise<void> {
    const { repositorio, transacao, eventos, carregar } = this.deps;
    const iniciativa = await carregar.executar(id);
    if (!iniciativa) throw new IniciativaNaoEncontradaError();
    mudar(iniciativa);
    await transacao.run(() => repositorio.salvar(iniciativa));
    eventos.publicar(iniciativa.pullEvents());
  }
}
