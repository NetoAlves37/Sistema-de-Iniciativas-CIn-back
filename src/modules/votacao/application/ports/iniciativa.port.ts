export interface EstadoIniciativa {
  id: string;
  autorId: string;
  status: string;
  ciclo: number;
}

/** Porta para o módulo `iniciativas`. O estado já vem com os prazos vencidos aplicados. */
export interface IniciativaPort {
  obterEstado(iniciativaId: string): Promise<EstadoIniciativa | null>;
}
