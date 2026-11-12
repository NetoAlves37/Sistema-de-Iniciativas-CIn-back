import type { TransacaoPort } from '@/shared/domain/transacao.port';
import {
  IniciativaNaoEncontradaError,
  VotacaoEncerradaError,
} from '../../domain/errors/votacao.errors';
import type { VotacaoRepository } from '../../domain/ports/votacao.repository';
import { wilson } from '../../domain/relevancia';
import { type AcaoVoto, decidirVoto, type MeuVoto, validarValorVoto } from '../../domain/voto';
import type { IniciativaPort } from '../ports/iniciativa.port';

export interface RegistrarVotoInput {
  iniciativaId: string;
  usuarioId: string;
  valor: number;
}

export interface ResultadoVotoDto {
  meuVoto: MeuVoto;
  likes: number;
  dislikes: number;
  relevancia: number;
  acao: AcaoVoto;
}

const STATUS_VOTACAO = 'EM_VOTACAO';

/** RN-07 e RN-08. O autor também pode votar. Tudo é por `(iniciativa, ciclo)`. */
export class RegistrarVoto {
  constructor(
    private readonly votacao: VotacaoRepository,
    private readonly iniciativas: IniciativaPort,
    private readonly transacao: TransacaoPort,
  ) {}

  async executar(input: RegistrarVotoInput): Promise<ResultadoVotoDto> {
    const valor = validarValorVoto(input.valor);
    const estado = await this.iniciativas.obterEstado(input.iniciativaId);
    if (!estado) throw new IniciativaNaoEncontradaError();
    if (estado.status !== STATUS_VOTACAO) throw new VotacaoEncerradaError();

    const { id: iniciativaId, ciclo } = estado;
    return this.transacao.run(async () => {
      await this.votacao.garantirPlacar(iniciativaId, ciclo);
      await this.votacao.travarPlacar(iniciativaId, ciclo);

      const atual = await this.votacao.buscarVoto(iniciativaId, ciclo, input.usuarioId);
      const decisao = decidirVoto(atual, valor);
      if (decisao.meuVoto === 0) {
        await this.votacao.removerVoto(iniciativaId, ciclo, input.usuarioId);
      } else {
        await this.votacao.gravarVoto(iniciativaId, ciclo, input.usuarioId, decisao.meuVoto);
      }

      const { likes, dislikes } = await this.votacao.contarVotos(iniciativaId, ciclo);
      const relevancia = wilson(likes, likes + dislikes);
      await this.votacao.salvarPlacar(iniciativaId, ciclo, { likes, dislikes, relevancia });

      return { meuVoto: decisao.meuVoto, likes, dislikes, relevancia, acao: decisao.acao };
    });
  }
}
