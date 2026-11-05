import { type DadosGoogleAgenda, googleAgendaUrl } from '../domain/google-agenda-url';

export type { DadosGoogleAgenda };

/**
 * API pública do módulo `divulgacao`. O módulo `iniciativas` a usa para montar o link do
 * Google Agenda no detalhe das iniciativas aprovadas.
 */
export class DivulgacaoFacade {
  /** Link "Adicionar ao Google Agenda" (HU-20), idêntico ao `gcalUrl()` do protótipo. */
  googleAgendaUrl(dados: DadosGoogleAgenda): string {
    return googleAgendaUrl(dados);
  }
}
