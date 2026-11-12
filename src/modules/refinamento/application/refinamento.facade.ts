import type { Clock } from '@/shared/domain/clock';
import type {
  ComentarioRepository,
  ParIniciativaCiclo,
} from '../domain/ports/comentario.repository';
import type { ComentarioDto, PaginaDeComentariosDto } from './dto/comentario.dto';
import type { AutoresPort } from './ports/autores.port';
import type { IniciativaPort } from './ports/iniciativa.port';
import { ContarSugestoes } from './queries/contar-sugestoes';
import { ListarComentarios } from './queries/listar-comentarios';
import { ComentarIniciativa } from './use-cases/comentar-iniciativa';

export type { ComentarioDto, PaginaDeComentariosDto, ParIniciativaCiclo };

/** API pública do módulo `refinamento`. */
export class RefinamentoFacade {
  private readonly comentarIniciativa: ComentarIniciativa;
  private readonly listarComentarios: ListarComentarios;
  private readonly contarSugestoesUseCase: ContarSugestoes;

  constructor(
    comentarios: ComentarioRepository,
    iniciativas: IniciativaPort,
    autores: AutoresPort,
    clock: Clock,
  ) {
    this.comentarIniciativa = new ComentarIniciativa(comentarios, iniciativas, autores, clock);
    this.listarComentarios = new ListarComentarios(comentarios, iniciativas, autores);
    this.contarSugestoesUseCase = new ContarSugestoes(comentarios);
  }

  /** RN-05. Erros: `nao_encontrado`, `conflito` (fora de Em andamento), `validacao`. */
  comentar(input: {
    iniciativaId: string;
    autorId: string;
    texto: string;
  }): Promise<ComentarioDto> {
    return this.comentarIniciativa.executar(input);
  }

  listar(input: {
    iniciativaId: string;
    page?: number;
    limit?: number;
  }): Promise<PaginaDeComentariosDto> {
    return this.listarComentarios.executar(input);
  }

  /**
   * Quantidade de sugestões de cada `(iniciativa, ciclo)`. Chave do mapa = `iniciativaId`;
   * ausente = 0. Usada por `iniciativas` para `sugestoesCicloAtual`.
   */
  contarSugestoes(pares: ParIniciativaCiclo[]): Promise<Map<string, number>> {
    return this.contarSugestoesUseCase.executar(pares);
  }
}
