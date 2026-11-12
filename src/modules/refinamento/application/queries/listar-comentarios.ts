import { IniciativaNaoEncontradaError } from '../../domain/errors/refinamento.errors';
import type { ComentarioRepository } from '../../domain/ports/comentario.repository';
import {
  LIMITE_PADRAO_COMENTARIOS,
  type PaginaDeComentariosDto,
  paraComentarioDto,
} from '../dto/comentario.dto';
import type { AutoresPort } from '../ports/autores.port';
import type { IniciativaPort } from '../ports/iniciativa.port';

export interface ListarComentariosInput {
  iniciativaId: string;
  page?: number;
  limit?: number;
}

export class ListarComentarios {
  constructor(
    private readonly comentarios: ComentarioRepository,
    private readonly iniciativas: IniciativaPort,
    private readonly autores: AutoresPort,
  ) {}

  async executar(input: ListarComentariosInput): Promise<PaginaDeComentariosDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? LIMITE_PADRAO_COMENTARIOS;
    const estado = await this.iniciativas.obterEstado(input.iniciativaId);
    if (!estado) throw new IniciativaNaoEncontradaError();

    const { items, total } = await this.comentarios.listarPorIniciativa(
      estado.id,
      (page - 1) * limit,
      limit,
    );
    const autores = await this.autores.mapaPorIds([...new Set(items.map((i) => i.autorId))]);
    return {
      items: items.map((item) => paraComentarioDto(item, autores, estado.autorId)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
