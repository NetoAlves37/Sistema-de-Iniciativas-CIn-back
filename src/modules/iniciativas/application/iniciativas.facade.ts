import type { StatusIniciativa } from '../domain/status';
import type {
  AprovadaParaCalendarioDto,
  AtorDto,
  DadosIniciativaInput,
  DetalheIniciativaDto,
  EstadoIniciativaDto,
  FiltroListagemDto,
  PaginaDto,
  ResumoIniciativaDto,
  TipoIniciativa,
  TransicaoDto,
} from './dto/iniciativa.dto';
import type { ConsultasIniciativas } from './queries/consultas-iniciativas';
import type { AplicarPrazosVencidos } from './use-cases/aplicar-prazos-vencidos';
import type { CarregarComPrazos } from './use-cases/carregar-com-prazos';
import type { DecidirIniciativa } from './use-cases/decidir-iniciativa';
import type { EditarIniciativa } from './use-cases/editar-iniciativa';
import type { RessubmeterIniciativa } from './use-cases/ressubmeter-iniciativa';
import type { SubmeterIniciativa } from './use-cases/submeter-iniciativa';

export type * from './dto/iniciativa.dto';

export interface RegistrarDecisaoInput {
  iniciativaId: string;
  resultado: 'APROVADA' | 'REPROVADA';
  justificativa?: string | null;
  /** Quem decide. O autor da iniciativa nunca pode decidir sobre ela (RN-10). */
  decisorId: string;
}

export interface FiltroCalendarioInput {
  /** Início do intervalo, `YYYY-MM-DD` (inclusivo). */
  de: string;
  /** Fim do intervalo, `YYYY-MM-DD` (exclusivo). */
  ate: string;
  tipos?: TipoIniciativa[];
  /** Só as iniciativas deste autor. */
  autorId?: string;
}

/**
 * API pública do módulo `iniciativas`. Os outros módulos só falam com ele por aqui, e
 * sempre por portas implementadas em `infrastructure/adapters` do módulo consumidor.
 * É o único módulo que muda o status de uma iniciativa.
 */
export class IniciativasFacade {
  constructor(
    private readonly submeterIniciativa: SubmeterIniciativa,
    private readonly editarIniciativa: EditarIniciativa,
    private readonly ressubmeterIniciativa: RessubmeterIniciativa,
    private readonly decidirIniciativa: DecidirIniciativa,
    private readonly consultas: ConsultasIniciativas,
    private readonly carregar: CarregarComPrazos,
    private readonly job: AplicarPrazosVencidos,
  ) {}

  // --- contrato usado pelos outros módulos --------------------------------------------------

  /**
   * Estado da iniciativa para validar operações de outros módulos (votar, comentar).
   * Aplica antes as transições por prazo vencidas (RN-06). `null` se não existir.
   */
  async obterEstado(iniciativaId: string): Promise<EstadoIniciativaDto | null> {
    const iniciativa = await this.carregar.executar(iniciativaId);
    if (!iniciativa) return null;
    return {
      id: iniciativa.id,
      autorId: iniciativa.autorId,
      status: iniciativa.status,
      ciclo: iniciativa.ciclo,
      comVotacao: iniciativa.comVotacao,
      fimRefinamento: iniciativa.fimRefinamento?.toISOString() ?? null,
      fimVotacao: iniciativa.fimVotacao?.toISOString() ?? null,
    };
  }

  /**
   * Registra a decisão do comitê (RN-10). Lança erros de domínio: `proibido` se o decisor
   * é o autor, `conflito` fora de Em análise ou se já foi decidida, `nao_encontrado` se
   * não existir. A validação da justificativa fica no caso de uso de `avaliacao`.
   */
  registrarDecisao(input: RegistrarDecisaoInput): Promise<void> {
    return this.decidirIniciativa.executar(
      input.iniciativaId,
      input.decisorId,
      input.resultado,
      input.justificativa,
    );
  }

  /** Listagem paginada de resumos, com filtros e ordenação no banco (RNF-05). */
  listar(filtro: FiltroListagemDto): Promise<PaginaDto<ResumoIniciativaDto>> {
    return this.consultas.listar(filtro);
  }

  /** Detalhe com permissões calculadas para o ator. Lança `nao_encontrado`. */
  detalhe(iniciativaId: string, ator: AtorDto): Promise<DetalheIniciativaDto> {
    return this.consultas.detalhe(iniciativaId, ator);
  }

  /** Iniciativas aprovadas cujo período pode cruzar o intervalo, para gerar ocorrências. */
  aprovadasParaCalendario(filtro: FiltroCalendarioInput): Promise<AprovadaParaCalendarioDto[]> {
    return this.consultas.aprovadasParaCalendario(filtro);
  }

  // --- usado pelos controllers e pelo job do próprio módulo ---------------------------------

  submeter(autorId: string, entrada: DadosIniciativaInput): Promise<string> {
    return this.submeterIniciativa.executar(autorId, entrada);
  }

  editar(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    return this.editarIniciativa.executar(id, usuarioId, entrada);
  }

  ressubmeter(id: string, usuarioId: string, entrada: DadosIniciativaInput): Promise<void> {
    return this.ressubmeterIniciativa.executar(id, usuarioId, entrada);
  }

  minhas(autorId: string, filtro: { status?: StatusIniciativa; page: number; limit: number }) {
    return this.consultas.minhas(autorId, filtro);
  }

  contagens(): Promise<{ emAnalise: number }> {
    return this.consultas.contagens();
  }

  historico(iniciativaId: string): Promise<TransicaoDto[]> {
    return this.consultas.historico(iniciativaId);
  }

  /** Aplica as transições por prazo vencidas (job). Devolve quantas iniciativas processou. */
  aplicarPrazosVencidos(): Promise<number> {
    return this.job.executar();
  }
}
