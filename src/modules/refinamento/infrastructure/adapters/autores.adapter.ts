import { Injectable } from '@nestjs/common';
import { IdentidadeFacade } from '@/modules/identidade/application/identidade.facade';
import type { AutoresPort, AutorInfo } from '../../application/ports/autores.port';

@Injectable()
export class AutoresAdapter implements AutoresPort {
  constructor(private readonly identidade: IdentidadeFacade) {}

  async mapaPorIds(ids: string[]): Promise<Map<string, AutorInfo>> {
    return this.identidade.mapaPorIds(ids);
  }
}
