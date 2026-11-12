import type { ItemFila } from '../dto/avaliacao.dto';
import type { IniciativasPort } from '../ports/iniciativas.port';

export interface ObterFilaInput {
  usuarioId: string;
  page: number;
  limit: number;
}

/** RN-09: fila do comitê, por relevância, com `souAutor` em cada item. */
export class ObterFila {
  constructor(private readonly iniciativas: IniciativasPort) {}

  async executar(input: ObterFilaInput): Promise<{ items: ItemFila[]; total: number }> {
    const pagina = await this.iniciativas.listarEmAnalise(input.page, input.limit);
    return {
      total: pagina.total,
      items: pagina.items.map((item) => ({ ...item, souAutor: item.autor.id === input.usuarioId })),
    };
  }
}
