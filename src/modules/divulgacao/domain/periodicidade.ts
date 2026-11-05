export const PERIODICIDADES = ['EVENTO_UNICO', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const TIPOS_INICIATIVA = ['EXTENSAO', 'PESQUISA', 'EVENTO'] as const;
export type TipoIniciativa = (typeof TIPOS_INICIATIVA)[number];
