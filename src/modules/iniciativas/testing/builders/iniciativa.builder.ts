import { Iniciativa, type IniciativaProps } from '@/modules/iniciativas/domain/iniciativa';
import type { PrazosConfig } from '@/modules/iniciativas/domain/ports/prazos-config';
import type { StatusIniciativa } from '@/modules/iniciativas/domain/status';
import {
  DadosIniciativa,
  type DadosIniciativaBrutos,
} from '@/modules/iniciativas/domain/value-objects/dados-iniciativa';

export const PRAZOS_PADRAO: PrazosConfig = { refinamentoDias: 3, votacaoDias: 3 };

export const AUTOR_PADRAO = 'autor-1';

/** Dados brutos válidos (RN-01 e RN-02) para os testes; sobrescreva o que precisar. */
export function dadosValidos(sobrescritas: DadosIniciativaBrutos = {}): DadosIniciativaBrutos {
  return {
    tipo: 'EVENTO',
    titulo: 'Hackathon de Acessibilidade Digital',
    resumo: 'Maratona de 24h para criar soluções acessíveis.',
    detalhe: 'Equipes de até 5 pessoas desenvolvem protótipos acessíveis.',
    inicio: '2026-12-10',
    fim: '2026-12-11',
    horaInicio: '09:00',
    horaFim: '18:00',
    periodicidade: 'EVENTO_UNICO',
    espaco: 'Auditório do CIn',
    organizadores: 'Bruno Lima, Diretório Acadêmico',
    membros: 'Ana Souza',
    participantes: 80,
    ...sobrescritas,
  };
}

export const dadosDeTeste = (sobrescritas: DadosIniciativaBrutos = {}) =>
  DadosIniciativa.criar(dadosValidos(sobrescritas));

/**
 * Builder de `Iniciativa` já persistida, no estado desejado:
 * `umaIniciativa().emVotacao().doAutor('ana').comVotacao(false).construir()`.
 */
export class IniciativaBuilder {
  private props: IniciativaProps;

  constructor() {
    const criadaEm = new Date('2026-11-02T12:00:00.000Z');
    this.props = {
      id: 'a0000000-0000-4000-8000-000000000001',
      autorId: AUTOR_PADRAO,
      dados: dadosDeTeste(),
      comVotacao: true,
      status: 'EM_ANDAMENTO',
      ciclo: 1,
      fimRefinamento: new Date('2026-11-05T12:00:00.000Z'),
      fimVotacao: null,
      justificativa: null,
      decisorId: null,
      decididaEm: null,
      version: 0,
      criadaEm,
    };
  }

  comId(id: string): this {
    this.props.id = id;
    return this;
  }

  doAutor(autorId: string): this {
    this.props.autorId = autorId;
    return this;
  }

  comVotacao(valor: boolean): this {
    this.props.comVotacao = valor;
    return this;
  }

  semVotacao(): this {
    return this.comVotacao(false);
  }

  noCiclo(ciclo: number): this {
    this.props.ciclo = ciclo;
    return this;
  }

  criadaEm(data: Date): this {
    this.props.criadaEm = data;
    return this;
  }

  comDados(sobrescritas: DadosIniciativaBrutos): this {
    this.props.dados = dadosDeTeste(sobrescritas);
    return this;
  }

  comPrazos(fimRefinamento: Date | null, fimVotacao: Date | null): this {
    this.props.fimRefinamento = fimRefinamento;
    this.props.fimVotacao = fimVotacao;
    return this;
  }

  noStatus(status: StatusIniciativa): this {
    this.props.status = status;
    return this;
  }

  emAndamento(): this {
    return this.noStatus('EM_ANDAMENTO');
  }

  emVotacao(): this {
    this.props.fimVotacao = this.props.fimVotacao ?? new Date('2026-11-08T12:00:00.000Z');
    return this.noStatus('EM_VOTACAO');
  }

  emAnalise(): this {
    return this.noStatus('EM_ANALISE');
  }

  aprovada(decisorId = 'decisor-1'): this {
    this.props.decisorId = decisorId;
    this.props.decididaEm = new Date('2026-11-12T12:00:00.000Z');
    return this.noStatus('APROVADA');
  }

  reprovada(justificativa = 'Precisa de ajustes.', decisorId = 'decisor-1'): this {
    this.props.decisorId = decisorId;
    this.props.decididaEm = new Date('2026-11-12T12:00:00.000Z');
    this.props.justificativa = justificativa;
    return this.noStatus('REPROVADA');
  }

  construir(): Iniciativa {
    return Iniciativa.reconstituir({ ...this.props });
  }
}

export const umaIniciativa = () => new IniciativaBuilder();
