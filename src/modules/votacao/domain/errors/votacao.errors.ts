import { DomainError } from '@/shared/domain/domain-error';

export class VotacaoEncerradaError extends DomainError {
  readonly code = 'VOTACAO_ENCERRADA';
  readonly tipo = 'conflito' as const;

  constructor() {
    super('A votação desta iniciativa foi encerrada.');
  }
}

export class IniciativaNaoEncontradaError extends DomainError {
  readonly code = 'INICIATIVA_NAO_ENCONTRADA';
  readonly tipo = 'nao_encontrado' as const;

  constructor() {
    super('Iniciativa não encontrada.');
  }
}
