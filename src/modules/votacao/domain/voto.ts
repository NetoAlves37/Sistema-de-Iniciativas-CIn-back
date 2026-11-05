import { ValidacaoError } from '@/shared/domain/domain-error';

export type ValorVoto = 1 | -1;
export type MeuVoto = 1 | -1 | 0;
export type AcaoVoto = 'REGISTRADO' | 'ALTERADO' | 'RETIRADO';

export const LIKE: ValorVoto = 1;
export const DISLIKE: ValorVoto = -1;

export function ehValorVoto(valor: unknown): valor is ValorVoto {
  return valor === LIKE || valor === DISLIKE;
}

/** Garante que `valor` é +1 ou −1; senão lança `ValidacaoError({ valor })`. */
export function validarValorVoto(valor: unknown): ValorVoto {
  if (!ehValorVoto(valor)) {
    throw new ValidacaoError({ valor: 'O voto deve ser 1 (curtir) ou -1 (não curtir).' });
  }
  return valor;
}

export interface DecisaoDeVoto {
  /** Voto do usuário depois da operação (0 = sem voto). */
  meuVoto: MeuVoto;
  acao: AcaoVoto;
}

/**
 * RN-07: o mesmo valor que o usuário já tem retira o voto; o valor oposto troca; sem voto
 * anterior, registra.
 */
export function decidirVoto(atual: MeuVoto, novo: ValorVoto): DecisaoDeVoto {
  if (atual === 0) return { meuVoto: novo, acao: 'REGISTRADO' };
  if (atual === novo) return { meuVoto: 0, acao: 'RETIRADO' };
  return { meuVoto: novo, acao: 'ALTERADO' };
}
