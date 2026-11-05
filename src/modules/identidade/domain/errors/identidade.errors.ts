import { DomainError } from '@/shared/domain/domain-error';

export class UsuarioInvalidoError extends DomainError {
  readonly code = 'USUARIO_INVALIDO';
  readonly tipo = 'validacao' as const;

  constructor(motivo: string) {
    super(`Usuário inválido: ${motivo}`);
  }
}

export class UsuarioNaoEncontradoError extends DomainError {
  readonly code = 'USUARIO_NAO_ENCONTRADO';
  readonly tipo = 'nao_encontrado' as const;

  constructor(readonly id: string) {
    super(`Usuário "${id}" não encontrado.`);
  }
}
