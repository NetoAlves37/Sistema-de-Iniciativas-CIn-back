import { ValidacaoError } from '@/shared/domain/domain-error';

export const TEXTO_MAXIMO = 1000;

export const MENSAGEM_TEXTO_VAZIO = 'Escreva sua sugestão antes de enviar.';
export const MENSAGEM_TEXTO_LONGO = `A sugestão pode ter no máximo ${TEXTO_MAXIMO} caracteres.`;

export interface DadosComentario {
  iniciativaId: string;
  ciclo: number;
  autorId: string;
  texto: string;
  criadoEm: Date;
}

/** Comentário (sugestão) ainda não persistido. O texto é aparado e validado (RN-05). */
export class Comentario {
  readonly iniciativaId: string;
  readonly ciclo: number;
  readonly autorId: string;
  readonly texto: string;
  readonly criadoEm: Date;

  private constructor(dados: DadosComentario) {
    this.iniciativaId = dados.iniciativaId;
    this.ciclo = dados.ciclo;
    this.autorId = dados.autorId;
    this.texto = dados.texto;
    this.criadoEm = dados.criadoEm;
  }

  static criar(dados: DadosComentario): Comentario {
    return new Comentario({ ...dados, texto: Comentario.validarTexto(dados.texto) });
  }

  /** Devolve o texto aparado ou lança `ValidacaoError({ texto })`. */
  static validarTexto(texto: string): string {
    const aparado = texto.trim();
    if (aparado.length === 0) {
      throw new ValidacaoError({ texto: MENSAGEM_TEXTO_VAZIO });
    }
    if (aparado.length > TEXTO_MAXIMO) {
      throw new ValidacaoError({ texto: MENSAGEM_TEXTO_LONGO });
    }
    return aparado;
  }
}
