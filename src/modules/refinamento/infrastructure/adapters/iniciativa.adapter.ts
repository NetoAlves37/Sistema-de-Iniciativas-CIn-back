import { Injectable } from '@nestjs/common';
import { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import type { EstadoIniciativa, IniciativaPort } from '../../application/ports/iniciativa.port';

@Injectable()
export class IniciativaAdapter implements IniciativaPort {
  constructor(private readonly iniciativas: IniciativasFacade) {}

  async obterEstado(iniciativaId: string): Promise<EstadoIniciativa | null> {
    const estado = await this.iniciativas.obterEstado(iniciativaId);
    if (!estado) return null;
    return {
      id: estado.id,
      autorId: estado.autorId,
      status: estado.status,
      ciclo: estado.ciclo,
    };
  }
}
