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

export type OperacaoDeEstado =
  | 'editar'
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
