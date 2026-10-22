export interface DadosGoogleAgenda {
  titulo: string;
  resumo: string;
  inicio: string;
  fim: string;
  horaInicio: string | null;
  horaFim: string | null;
  periodicidade: string;
  espaco: string;
  organizadores: string;
}

/** Link do Google Agenda de uma aprovada (implementada com o módulo `divulgacao`). */
export interface GoogleAgendaPort {
  url(dados: DadosGoogleAgenda): string;
}
