export const TIPOS_INICIATIVA = ['EXTENSAO', 'PESQUISA', 'EVENTO'] as const;
export type TipoIniciativa = (typeof TIPOS_INICIATIVA)[number];

export const ROTULO_TIPO: Record<TipoIniciativa, string> = {
  EXTENSAO: 'Extensão',
  PESQUISA: 'Pesquisa',
  EVENTO: 'Evento',
};

export const PERIODICIDADES = ['EVENTO_UNICO', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  EVENTO_UNICO: 'Evento único',
  DIARIA: 'Diária',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
};
