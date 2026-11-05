import { googleAgendaUrl } from '../../domain/google-agenda-url';
import { validarIntervalo } from '../../domain/intervalo';
import { gerarOcorrencias } from '../../domain/recorrencia';
import type { OcorrenciaCalendario, TipoIniciativa } from '../dto/divulgacao.dto';
import type { IniciativasPort } from '../ports/iniciativas.port';

export interface ListarOcorrenciasInput {
  /** `YYYY-MM-DD`, inclusivo. */
  de: string;
  /** `YYYY-MM-DD`, exclusivo. Até 62 dias depois de `de`. */
  ate: string;
  tipos?: TipoIniciativa[];
  /** Só as iniciativas do usuário logado (RN-12.6). */
  minhas?: boolean;
  usuarioId: string;
}

/** RN-12: ocorrências das aprovadas em `[de, ate)`. */
export class ListarOcorrencias {
  constructor(private readonly iniciativas: IniciativasPort) {}

  async executar(input: ListarOcorrenciasInput): Promise<OcorrenciaCalendario[]> {
    validarIntervalo(input.de, input.ate);
    const aprovadas = await this.iniciativas.aprovadasParaCalendario({
      de: input.de,
      ate: input.ate,
      tipos: input.tipos && input.tipos.length > 0 ? input.tipos : undefined,
      autorId: input.minhas ? input.usuarioId : undefined,
    });

    const resultado: OcorrenciaCalendario[] = [];
    for (const iniciativa of aprovadas) {
      const ocorrencias = gerarOcorrencias(iniciativa, input.de, input.ate);
      if (ocorrencias.length === 0) continue;
      const link = googleAgendaUrl(iniciativa);
      for (const ocorrencia of ocorrencias) {
        resultado.push({
          iniciativaId: iniciativa.id,
          titulo: iniciativa.titulo,
          tipo: iniciativa.tipo,
          inicio: ocorrencia.inicio,
          fim: ocorrencia.fim,
          diaInteiro: ocorrencia.diaInteiro,
          espaco: iniciativa.espaco,
          organizadores: iniciativa.organizadores,
          periodicidade: iniciativa.periodicidade,
          periodoInicio: iniciativa.inicio,
          periodoFim: iniciativa.fim,
          googleAgendaUrl: link,
        });
      }
    }
    // Ordem cronológica; a ordenação é estável, então o empate mantém a ordem da fonte.
    return resultado.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  }
}
