export const PERIODICIDADES = ['EVENTO_UNICO', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

/** Código de um tipo do cadastro de `iniciativas` (por exemplo `PALESTRA`). */
export type TipoIniciativa = string;

/** Formato do código (o mesmo de `iniciativas`): maiúsculas sem acento, dígitos e `_`. */
export const FORMATO_CODIGO_TIPO = /^[A-Z0-9_]{1,40}$/;
