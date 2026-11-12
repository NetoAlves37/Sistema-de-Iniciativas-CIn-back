import type { TransacaoPort } from '@/shared/domain/transacao.port';
import type {
  ParIniciativaCiclo,
  Placar,
  VotacaoRepository,
} from '../domain/ports/votacao.repository';
import type { MeuVoto } from '../domain/voto';
import type { IniciativaPort } from './ports/iniciativa.port';
import {
  RegistrarVoto,
  type RegistrarVotoInput,
  type ResultadoVotoDto,
} from './use-cases/registrar-voto';

export type { MeuVoto, ParIniciativaCiclo, Placar, RegistrarVotoInput, ResultadoVotoDto };

const SEM_VOTOS: Placar = { likes: 0, dislikes: 0, relevancia: 0 };

/** API pública do módulo `votacao`. */
export class VotacaoFacade {
  private readonly registrarVoto: RegistrarVoto;

  constructor(
    private readonly votacao: VotacaoRepository,
    iniciativas: IniciativaPort,
    transacao: TransacaoPort,
  ) {
    this.registrarVoto = new RegistrarVoto(votacao, iniciativas, transacao);
  }

  /** RN-07. Erros: `nao_encontrado`, `conflito` (fora de Em votação), `validacao`. */
  votar(input: RegistrarVotoInput): Promise<ResultadoVotoDto> {
    return this.registrarVoto.executar(input);
  }

  /** Placar do ciclo. Zeros se não houver linha. */
  async placar(iniciativaId: string, ciclo: number): Promise<Placar> {
    return (await this.votacao.buscarPlacar(iniciativaId, ciclo)) ?? { ...SEM_VOTOS };
  }

  /** Placares em lote. Chave = `iniciativaId`; ausente = sem votos (zeros). */
  placares(pares: ParIniciativaCiclo[]): Promise<Map<string, Placar>> {
    if (pares.length === 0) return Promise.resolve(new Map());
    return this.votacao.buscarPlacares(pares);
  }

  /** Voto do usuário no ciclo: 1, -1 ou 0. */
  meuVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<MeuVoto> {
    return this.votacao.buscarVoto(iniciativaId, ciclo, usuarioId);
  }
}
