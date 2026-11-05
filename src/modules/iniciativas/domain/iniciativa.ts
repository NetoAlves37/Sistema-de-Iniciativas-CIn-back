import type { Clock } from '@/shared/domain/clock';
import type { DomainEvent } from '@/shared/domain/domain-event';
import {
  AutorNaoPodeDecidirError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from './errors/iniciativas.errors';
import {
  IniciativaDecidida,
  IniciativaEditada,
  IniciativaRessubmetida,
  IniciativaSubmetida,
  RefinamentoEncerrado,
  VotacaoEncerrada,
} from './events/iniciativa.events';
import { MS_POR_DIA, type PrazosConfig } from './ports/prazos-config';
import type { StatusIniciativa } from './status';
import type { DadosIniciativa } from './value-objects/dados-iniciativa';

/** Autor das transições feitas pelo job e pelos prazos. */
export const AUTOR_SISTEMA = 'SISTEMA';

export const NOTAS = {
  submetida: 'Submetida e aberta a sugestões',
  editada: 'Iniciativa editada durante o refinamento',
  refinamentoEncerrado: 'Prazo de refinamento encerrado',
  votacaoEncerrada: 'Prazo de votação encerrado',
  aprovada: 'Aprovada pelo comitê',
  reprovada: 'Reprovada pelo comitê',
  ressubmetida: (ciclo: number) => `Ressubmetida após reprovação (ciclo ${ciclo})`,
} as const;

/** Uma entrada do histórico de status. */
export interface Transicao {
  de: StatusIniciativa | null;
  para: StatusIniciativa;
  /** Id do usuário ou `SISTEMA`. */
  por: string;
  nota: string;
  /** Preenchida na reprovação, para preservar o texto após a ressubmissão. */
  justificativa: string | null;
  ocorreuEm: Date;
  ciclo: number;
}

export interface IniciativaProps {
  id: string;
  autorId: string;
  dados: DadosIniciativa;
  comVotacao: boolean;
  status: StatusIniciativa;
  ciclo: number;
  fimRefinamento: Date | null;
  fimVotacao: Date | null;
  justificativa: string | null;
  decisorId: string | null;
  decididaEm: Date | null;
  version: number;
  criadaEm: Date;
}

export interface Permissoes {
  podeEditar: boolean;
  podeComentar: boolean;
  podeVotar: boolean;
  podeDecidir: boolean;
  motivoNaoPodeDecidir?: string;
  podeRessubmeter: boolean;
}

const diasEmMs = (dias: number) => Math.round(dias * MS_POR_DIA);

/**
 * Agregado `Iniciativa`: dono da máquina de estados (RN-03, 04, 06, 10, 11). O estado é
 * privado; só os métodos de comportamento o alteram e registram transições (histórico) e
 * eventos de domínio.
 */
export class Iniciativa {
  private transicoesNovas: Transicao[] = [];
  private eventos: DomainEvent[] = [];

  private constructor(
    private props: IniciativaProps,
    private ehNova: boolean,
  ) {}

  // --- criação ---------------------------------------------------------------------------

  /** RN-03: cria em `EM_ANDAMENTO`, ciclo 1, com `fimRefinamento = agora + prazo`. */
  static submeter(
    dados: DadosIniciativa,
    autorId: string,
    comVotacao: boolean,
    clock: Clock,
    prazos: PrazosConfig,
  ): Iniciativa {
    const agora = clock.now();
    const iniciativa = new Iniciativa(
      {
        id: globalThis.crypto.randomUUID(),
        autorId,
        dados,
        comVotacao,
        status: 'EM_ANDAMENTO',
        ciclo: 1,
        fimRefinamento: new Date(agora.getTime() + diasEmMs(prazos.refinamentoDias)),
        fimVotacao: null,
        justificativa: null,
        decisorId: null,
        decididaEm: null,
        version: 0,
        criadaEm: agora,
      },
      true,
    );
    iniciativa.registrar(null, 'EM_ANDAMENTO', autorId, NOTAS.submetida, agora);
    iniciativa.eventos.push(new IniciativaSubmetida(iniciativa.props.id, 1, agora));
    return iniciativa;
  }

  /** Reconstitui uma iniciativa já persistida (sem eventos nem transições pendentes). */
  static reconstituir(props: IniciativaProps): Iniciativa {
    return new Iniciativa({ ...props }, false);
  }

  // --- leitura ---------------------------------------------------------------------------

  get id(): string {
    return this.props.id;
  }
  get autorId(): string {
    return this.props.autorId;
  }
  get dados(): DadosIniciativa {
    return this.props.dados;
  }
  get comVotacao(): boolean {
    return this.props.comVotacao;
  }
  get status(): StatusIniciativa {
    return this.props.status;
  }
  get ciclo(): number {
    return this.props.ciclo;
  }
  get fimRefinamento(): Date | null {
    return this.props.fimRefinamento;
  }
  get fimVotacao(): Date | null {
    return this.props.fimVotacao;
  }
  get justificativa(): string | null {
    return this.props.justificativa;
  }
  get decisorId(): string | null {
    return this.props.decisorId;
  }
  get decididaEm(): Date | null {
    return this.props.decididaEm;
  }
  get version(): number {
    return this.props.version;
  }
  get criadaEm(): Date {
    return this.props.criadaEm;
  }
  get nova(): boolean {
    return this.ehNova;
  }

  /** Transições ainda não gravadas (o repositório as persiste junto com a iniciativa). */
  novasTransicoes(): readonly Transicao[] {
    return this.transicoesNovas;
  }

  pullEvents(): DomainEvent[] {
    const eventos = this.eventos;
    this.eventos = [];
    return eventos;
  }

  /** Chamado pelo repositório depois de gravar: limpa o pendente e avança a versão. */
  confirmarGravacao(): void {
    this.transicoesNovas = [];
    this.props = { ...this.props, version: this.props.version + 1 };
    this.ehNova = false;
  }

  // --- comportamento ---------------------------------------------------------------------

  /** RN-04: só o autor (403) e só em `EM_ANDAMENTO` (409). Pode mudar `comVotacao`. */
  editar(dados: DadosIniciativa, comVotacao: boolean, porUsuarioId: string, clock: Clock): void {
    if (porUsuarioId !== this.props.autorId) throw new SomenteAutorError('editar');
    if (this.props.status !== 'EM_ANDAMENTO') {
      throw new TransicaoInvalidaError(this.props.status, 'editar');
    }
    const agora = clock.now();
    this.props = { ...this.props, dados, comVotacao };
    this.registrar('EM_ANDAMENTO', 'EM_ANDAMENTO', porUsuarioId, NOTAS.editada, agora);
    this.eventos.push(new IniciativaEditada(this.props.id, this.props.ciclo, agora));
  }

  /**
   * RN-06: fim do refinamento. Com votação vai para `EM_VOTACAO` (com `fimVotacao =
   * fimRefinamento + prazo`); sem votação, direto para `EM_ANALISE`. O histórico registra o
   * prazo vencido, não o instante da execução.
   */
  encerrarRefinamento(prazos: PrazosConfig): void {
    if (this.props.status !== 'EM_ANDAMENTO') {
      throw new TransicaoInvalidaError(this.props.status, 'encerrarRefinamento');
    }
    const prazo = this.props.fimRefinamento ?? this.props.criadaEm;
    if (this.props.comVotacao) {
      this.props = {
        ...this.props,
        status: 'EM_VOTACAO',
        fimVotacao: new Date(prazo.getTime() + diasEmMs(prazos.votacaoDias)),
      };
      this.registrar(
        'EM_ANDAMENTO',
        'EM_VOTACAO',
        AUTOR_SISTEMA,
        NOTAS.refinamentoEncerrado,
        prazo,
      );
      this.eventos.push(
        new RefinamentoEncerrado(this.props.id, this.props.ciclo, prazo, 'EM_VOTACAO'),
      );
    } else {
      this.props = { ...this.props, status: 'EM_ANALISE' };
      this.registrar(
        'EM_ANDAMENTO',
        'EM_ANALISE',
        AUTOR_SISTEMA,
        NOTAS.refinamentoEncerrado,
        prazo,
      );
      this.eventos.push(
        new RefinamentoEncerrado(this.props.id, this.props.ciclo, prazo, 'EM_ANALISE'),
      );
    }
  }

  /** RN-06: fim da votação, vai para `EM_ANALISE`. */
  encerrarVotacao(): void {
    if (this.props.status !== 'EM_VOTACAO') {
      throw new TransicaoInvalidaError(this.props.status, 'encerrarVotacao');
    }
    const prazo = this.props.fimVotacao ?? this.props.criadaEm;
    this.props = { ...this.props, status: 'EM_ANALISE' };
    this.registrar('EM_VOTACAO', 'EM_ANALISE', AUTOR_SISTEMA, NOTAS.votacaoEncerrada, prazo);
    this.eventos.push(new VotacaoEncerrada(this.props.id, this.props.ciclo, prazo));
  }

  /**
   * RN-06: aplica as transições cujo prazo já venceu em `clock.now()`. Uma iniciativa
   * vencida há muito tempo passa pelas duas transições na mesma chamada (duas entradas).
   */
  aplicarPrazosVencidos(clock: Clock, prazos: PrazosConfig): Transicao[] {
    const antes = this.transicoesNovas.length;
    const agora = clock.now().getTime();
    if (
      this.props.status === 'EM_ANDAMENTO' &&
      this.props.fimRefinamento &&
      agora >= this.props.fimRefinamento.getTime()
    ) {
      this.encerrarRefinamento(prazos);
    }
    if (
      this.props.status === 'EM_VOTACAO' &&
      this.props.fimVotacao &&
      agora >= this.props.fimVotacao.getTime()
    ) {
      this.encerrarVotacao();
    }
    return this.transicoesNovas.slice(antes);
  }

  /**
   * RN-10: só em `EM_ANALISE`; o autor não decide a própria iniciativa (403); reprovar
   * exige justificativa (validada no caso de uso, que também a apara). Registra decisor,
   * data e o histórico.
   */
  decidir(
    resultado: 'APROVADA' | 'REPROVADA',
    justificativa: string | undefined,
    decisorId: string,
    clock: Clock,
  ): void {
    if (decisorId === this.props.autorId) throw new AutorNaoPodeDecidirError();
    if (this.props.status !== 'EM_ANALISE') {
      throw new TransicaoInvalidaError(this.props.status, 'decidir');
    }
    const agora = clock.now();
    const texto = resultado === 'REPROVADA' ? (justificativa?.trim() ?? '') : '';
    this.props = {
      ...this.props,
      status: resultado,
      decisorId,
      decididaEm: agora,
      justificativa: resultado === 'REPROVADA' ? texto : null,
    };
    this.registrar(
      'EM_ANALISE',
      resultado,
      decisorId,
      resultado === 'APROVADA' ? NOTAS.aprovada : NOTAS.reprovada,
      agora,
      resultado === 'REPROVADA' ? texto : null,
    );
    this.eventos.push(
      new IniciativaDecidida(this.props.id, this.props.ciclo, agora, resultado, decisorId),
    );
  }

  /**
   * RN-11: só o autor (403), só em `REPROVADA` (409). Incrementa o ciclo, reabre o
   * refinamento com novo prazo e limpa a decisão (a justificativa anterior fica no histórico).
   */
  ressubmeter(
    dados: DadosIniciativa,
    comVotacao: boolean,
    porUsuarioId: string,
    clock: Clock,
    prazos: PrazosConfig,
  ): void {
    if (porUsuarioId !== this.props.autorId) throw new SomenteAutorError('ressubmeter');
    if (this.props.status !== 'REPROVADA') {
      throw new TransicaoInvalidaError(this.props.status, 'ressubmeter');
    }
    const agora = clock.now();
    const ciclo = this.props.ciclo + 1;
    this.props = {
      ...this.props,
      dados,
      comVotacao,
      status: 'EM_ANDAMENTO',
      ciclo,
      fimRefinamento: new Date(agora.getTime() + diasEmMs(prazos.refinamentoDias)),
      fimVotacao: null,
      decisorId: null,
      decididaEm: null,
      justificativa: null,
    };
    this.registrar('REPROVADA', 'EM_ANDAMENTO', porUsuarioId, NOTAS.ressubmetida(ciclo), agora);
    this.eventos.push(new IniciativaRessubmetida(this.props.id, ciclo, agora));
  }

  /** O que o usuário pode fazer agora. Calculado no domínio: o front não recalcula regras. */
  permissoesPara(usuario: { id: string; ehComite: boolean }, clock: Clock): Permissoes {
    const agora = clock.now().getTime();
    const ehAutor = usuario.id === this.props.autorId;
    const refinamentoAberto =
      this.props.status === 'EM_ANDAMENTO' &&
      !(this.props.fimRefinamento && agora >= this.props.fimRefinamento.getTime());
    const votacaoAberta =
      this.props.status === 'EM_VOTACAO' &&
      !(this.props.fimVotacao && agora >= this.props.fimVotacao.getTime());
    const emAnalise = this.props.status === 'EM_ANALISE';

    const permissoes: Permissoes = {
      podeEditar: ehAutor && refinamentoAberto,
      podeComentar: refinamentoAberto,
      podeVotar: votacaoAberta,
      podeDecidir: usuario.ehComite && emAnalise && !ehAutor,
      podeRessubmeter: ehAutor && this.props.status === 'REPROVADA',
    };
    if (usuario.ehComite && emAnalise && ehAutor) {
      permissoes.motivoNaoPodeDecidir = new AutorNaoPodeDecidirError().message;
    }
    return permissoes;
  }

  // --- interno ---------------------------------------------------------------------------

  private registrar(
    de: StatusIniciativa | null,
    para: StatusIniciativa,
    por: string,
    nota: string,
    ocorreuEm: Date,
    justificativa: string | null = null,
  ): void {
    this.transicoesNovas.push({
      de,
      para,
      por,
      nota,
      justificativa,
      ocorreuEm,
      ciclo: this.props.ciclo,
    });
  }
}
