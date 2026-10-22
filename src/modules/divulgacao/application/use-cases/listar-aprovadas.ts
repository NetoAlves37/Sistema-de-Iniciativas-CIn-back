import type { ResumoIniciativa, TipoIniciativa } from '../dto/divulgacao.dto';
import type { IniciativasPort } from '../ports/iniciativas.port';

export interface ListarAprovadasInput {
  q?: string;
  tipo?: TipoIniciativa;
  page: number;
  limit: number;
}

/** RN-12: aprovadas visíveis a todos, com busca e filtro por tipo feitos no servidor. */
export class ListarAprovadas {
  constructor(private readonly iniciativas: IniciativasPort) {}

  executar(input: ListarAprovadasInput): Promise<{ items: ResumoIniciativa[]; total: number }> {
    const q = input.q?.trim();
    return this.iniciativas.listarAprovadas({
      q: q ? q : undefined,
      tipo: input.tipo,
      page: input.page,
      limit: input.limit,
    });
  }
}
