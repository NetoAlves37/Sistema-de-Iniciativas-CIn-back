import type { Clock } from '@/shared/domain/clock';
import { Comentario } from '../../domain/comentario';
import {
  FaseDeSugestoesEncerradaError,
  IniciativaNaoEncontradaError,
} from '../../domain/errors/refinamento.errors';
import type { ComentarioRepository } from '../../domain/ports/comentario.repository';
import { type ComentarioDto, paraComentarioDto } from '../dto/comentario.dto';
import type { AutoresPort } from '../ports/autores.port';
import type { IniciativaPort } from '../ports/iniciativa.port';

export interface ComentarIniciativaInput {
  iniciativaId: string;
  autorId: string;
  texto: string;
}

const STATUS_REFINAMENTO = 'EM_ANDAMENTO';

/** RN-05: qualquer usuário autenticado, inclusive o autor, comenta só em Em andamento. */
export class ComentarIniciativa {
  constructor(
    private readonly comentarios: ComentarioRepository,
    private readonly iniciativas: IniciativaPort,
    private readonly autores: AutoresPort,
    private readonly clock: Clock,
  ) {}

  async executar(input: ComentarIniciativaInput): Promise<ComentarioDto> {
    const texto = Comentario.validarTexto(input.texto);
    const estado = await this.iniciativas.obterEstado(input.iniciativaId);
    if (!estado) throw new IniciativaNaoEncontradaError();
    if (estado.status !== STATUS_REFINAMENTO) throw new FaseDeSugestoesEncerradaError();

    const comentario = Comentario.criar({
      iniciativaId: estado.id,
      ciclo: estado.ciclo,
      autorId: input.autorId,
      texto,
      criadoEm: this.clock.now(),
    });
    const salvo = await this.comentarios.salvar(comentario);
    const autores = await this.autores.mapaPorIds([salvo.autorId]);
    return paraComentarioDto(salvo, autores, estado.autorId);
  }
}
