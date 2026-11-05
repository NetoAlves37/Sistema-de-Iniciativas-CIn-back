/**
 * Categoria de um erro de domínio. É semântica de negócio, não HTTP: a camada de
 * apresentação (`HttpExceptionFilter`) traduz cada categoria para um status.
 *
 *  - `validacao`: dado inválido (422, com `errors` por campo quando é um `ValidacaoError`);
 *  - `proibido`: o usuário não pode fazer isso (403);
 *  - `nao_encontrado`: o recurso não existe (404);
 *  - `conflito`: o estado atual impede a operação, ou houve concorrência (409).
 */
export type TipoErroDominio = 'validacao' | 'proibido' | 'nao_encontrado' | 'conflito';

/**
 * Base dos erros de domínio. Cada erro carrega um `code` estável, uma categoria e uma
 * mensagem em português pronta para a tela.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly tipo: TipoErroDominio;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Erro de validação com a mensagem de cada campo inválido (nomes dos campos do DTO). */
export class ValidacaoError extends DomainError {
  readonly code = 'VALIDACAO';
  readonly tipo = 'validacao' as const;

  constructor(
    readonly campos: Record<string, string>,
    mensagem = 'Um ou mais campos precisam ser corrigidos.',
  ) {
    super(mensagem);
  }
}
