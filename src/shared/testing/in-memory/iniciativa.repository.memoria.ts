import { ConcorrenciaError } from '@/modules/iniciativas/domain/errors/iniciativas.errors';
import {
  Iniciativa,
  type IniciativaProps,
  type Transicao,
} from '@/modules/iniciativas/domain/iniciativa';
import type { IniciativaRepository } from '@/modules/iniciativas/domain/ports/iniciativa.repository';

function propsDe(iniciativa: Iniciativa): IniciativaProps {
  return {
    id: iniciativa.id,
    autorId: iniciativa.autorId,
    dados: iniciativa.dados,
    comVotacao: iniciativa.comVotacao,
    status: iniciativa.status,
    ciclo: iniciativa.ciclo,
    fimRefinamento: iniciativa.fimRefinamento,
    fimVotacao: iniciativa.fimVotacao,
    justificativa: iniciativa.justificativa,
    decisorId: iniciativa.decisorId,
    decididaEm: iniciativa.decididaEm,
    version: iniciativa.version,
    criadaEm: iniciativa.criadaEm,
  };
}

/** Repositório em memória para testes de aplicação (mesma concorrência otimista do real). */
export class IniciativaRepositoryEmMemoria implements IniciativaRepository {
  private readonly iniciativas = new Map<string, IniciativaProps>();
  readonly historico: Array<Transicao & { iniciativaId: string }> = [];
  salvamentos = 0;

  /** Insere uma iniciativa já pronta (como se tivesse sido persistida antes). */
  semear(iniciativa: Iniciativa): void {
    this.iniciativas.set(iniciativa.id, propsDe(iniciativa));
  }

  async buscarPorId(id: string): Promise<Iniciativa | null> {
    const props = this.iniciativas.get(id);
    return props ? Iniciativa.reconstituir({ ...props }) : null;
  }

  async criar(iniciativa: Iniciativa): Promise<void> {
    this.gravarHistorico(iniciativa);
    iniciativa.confirmarGravacao();
    this.iniciativas.set(iniciativa.id, propsDe(iniciativa));
  }

  async salvar(iniciativa: Iniciativa): Promise<void> {
    const atual = this.iniciativas.get(iniciativa.id);
    if (!atual || atual.version !== iniciativa.version) throw new ConcorrenciaError();
    this.salvamentos++;
    this.gravarHistorico(iniciativa);
    iniciativa.confirmarGravacao();
    this.iniciativas.set(iniciativa.id, propsDe(iniciativa));
  }

  async idsComPrazoVencido(agora: Date, limite: number): Promise<string[]> {
    return [...this.iniciativas.values()]
      .filter(
        (p) =>
          (p.status === 'EM_ANDAMENTO' && p.fimRefinamento && p.fimRefinamento <= agora) ||
          (p.status === 'EM_VOTACAO' && p.fimVotacao && p.fimVotacao <= agora),
      )
      .map((p) => p.id)
      .slice(0, limite);
  }

  /** Estado persistido, para asserções. */
  persistida(id: string): IniciativaProps {
    const props = this.iniciativas.get(id);
    if (!props) throw new Error(`Iniciativa ${id} não está no repositório.`);
    return props;
  }

  private gravarHistorico(iniciativa: Iniciativa): void {
    for (const transicao of iniciativa.novasTransicoes()) {
      this.historico.push({ ...transicao, iniciativaId: iniciativa.id });
    }
  }
}
