import { DomainError } from '@/shared/domain/domain-error';

export class FaseDeSugestoesEncerradaError extends DomainError {
  readonly code = 'FASE_SUGESTOES_ENCERRADA';
  readonly tipo = 'conflito' as const;

  constructor() {
    super('A fase de sugestões terminou.');
  }
}

export class IniciativaNaoEncontradaError extends DomainError {
  readonly code = 'INICIATIVA_NAO_ENCONTRADA';
  readonly tipo = 'nao_encontrado' as const;

  constructor() {
    super('Iniciativa não encontrada.');
  }
}
