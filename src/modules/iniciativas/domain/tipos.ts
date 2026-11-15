/**
 * Código de um tipo de iniciativa (por exemplo `PALESTRA`). Os tipos são um cadastro mantido
 * pelo comitê e pelo ADMIN (`TipoDeIniciativa`), então o código é texto no formato
 * `FORMATO_CODIGO_TIPO`; se ele existe e está ativo, quem confere é o caso de uso.
 */
export type TipoIniciativa = string;

/** Letras maiúsculas sem acento, dígitos e `_`, até 40 caracteres. */
export const FORMATO_CODIGO_TIPO = /^[A-Z0-9_]{1,40}$/;

export const PERIODICIDADES = ['EVENTO_UNICO', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  EVENTO_UNICO: 'Evento único',
  DIARIA: 'Diária',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
};
