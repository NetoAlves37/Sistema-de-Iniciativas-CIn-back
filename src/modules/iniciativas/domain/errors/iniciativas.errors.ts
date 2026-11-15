import { DomainError } from '@/shared/domain/domain-error';
import { ROTULO_STATUS, type StatusIniciativa } from '../status';

export class IniciativaNaoEncontradaError extends DomainError {
  readonly code = 'INICIATIVA_NAO_ENCONTRADA';
  readonly tipo = 'nao_encontrado' as const;

  constructor() {
    super('Iniciativa não encontrada.');
  }
}

/** Só o autor edita ou ressubmete a própria iniciativa. */
export class SomenteAutorError extends DomainError {
  readonly code = 'SOMENTE_AUTOR';
  readonly tipo = 'proibido' as const;

  constructor(acao: 'editar' | 'ressubmeter') {
    super(`Só o autor pode ${acao} esta iniciativa.`);
  }
}

/** O autor não decide sobre a própria iniciativa (RN-10: conflito de interesse). */
export class AutorNaoPodeDecidirError extends DomainError {
  readonly code = 'AUTOR_NAO_PODE_DECIDIR';
  readonly tipo = 'proibido' as const;

  constructor() {
    super(
      'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
    );
  }
}

/** Só o comitê (ou o ADMIN) altera as datas de uma iniciativa aprovada. */
export class SomenteComiteError extends DomainError {
  readonly code = 'SOMENTE_COMITE';
  readonly tipo = 'proibido' as const;

  constructor(acao = 'alterar as datas desta iniciativa') {
    super(`Só o comitê ou um administrador pode ${acao}.`);
  }
}

export type OperacaoDeEstado =
  | 'editar'
  | 'alterarDatas'
  | 'ressubmeter'
  | 'decidir'
  | 'encerrarRefinamento'
  | 'encerrarVotacao';

/** A operação não é permitida no status atual da iniciativa (409). */
export class TransicaoInvalidaError extends DomainError {
  readonly code = 'TRANSICAO_INVALIDA';
  readonly tipo = 'conflito' as const;

  constructor(
    readonly status: StatusIniciativa,
    readonly operacao: OperacaoDeEstado,
  ) {
    super(TransicaoInvalidaError.mensagem(status, operacao));
  }

  private static mensagem(status: StatusIniciativa, operacao: OperacaoDeEstado): string {
    const rotulo = ROTULO_STATUS[status];
    switch (operacao) {
      case 'editar':
        return `Iniciativas com status "${rotulo}" não podem ser editadas.`;
      case 'ressubmeter':
        return `Iniciativas com status "${rotulo}" não podem ser ressubmetidas.`;
      case 'decidir':
        return status === 'APROVADA' || status === 'REPROVADA'
          ? 'Esta iniciativa já foi decidida.'
          : 'Esta iniciativa ainda não está em análise.';
      case 'alterarDatas':
        return 'Só iniciativas aprovadas podem ter as datas alteradas.';
      default:
        return `Operação inválida para iniciativas com status "${rotulo}".`;
    }
  }
}

/** Outra gravação mudou a iniciativa entre a leitura e a escrita (concorrência otimista, 409). */
export class ConcorrenciaError extends DomainError {
  readonly code = 'CONCORRENCIA';
  readonly tipo = 'conflito' as const;

  constructor(mensagem = 'Esta iniciativa foi alterada por outra pessoa. Recarregue a página.') {
    super(mensagem);
  }
}

/**
 * O autor já tem uma iniciativa ativa com o mesmo título, a mesma data de início e o mesmo
 * horário de início (409). Evita a mesma submissão repetida, inclusive por duplo clique.
 */
export class IniciativaDuplicadaError extends DomainError {
  readonly code = 'INICIATIVA_DUPLICADA';
  readonly tipo = 'conflito' as const;

  constructor() {
    super('Você já submeteu uma iniciativa com este título, nesta data e neste horário.');
  }
}

export class TipoNaoEncontradoError extends DomainError {
  readonly code = 'TIPO_NAO_ENCONTRADO';
  readonly tipo = 'nao_encontrado' as const;

  constructor() {
    super('Tipo de iniciativa não encontrado.');
  }
}

/** Tipo com iniciativas associadas não pode ser excluído (só desativado). */
export class TipoEmUsoError extends DomainError {
  readonly code = 'TIPO_EM_USO';
  readonly tipo = 'conflito' as const;

  constructor(readonly quantidade?: number) {
    super(TipoEmUsoError.mensagem(quantidade));
  }

  private static mensagem(quantidade?: number): string {
    const sufixo = 'Você pode desativá-lo.';
    if (quantidade === undefined) {
      return `Este tipo não pode ser excluído porque há iniciativas associadas a ele. ${sufixo}`;
    }
    const iniciativas = quantidade === 1 ? 'iniciativa associada' : 'iniciativas associadas';
    return `Este tipo não pode ser excluído porque há ${quantidade} ${iniciativas} a ele. ${sufixo}`;
  }
}
