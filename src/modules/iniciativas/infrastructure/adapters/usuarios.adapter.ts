import { Injectable } from '@nestjs/common';
import { IdentidadeFacade } from '@/modules/identidade/application/identidade.facade';
import type { UsuarioResumo, UsuariosPort } from '../../application/ports/usuarios.port';

@Injectable()
export class UsuariosAdapter implements UsuariosPort {
  constructor(private readonly identidade: IdentidadeFacade) {}

  mapaPorIds(ids: string[]): Promise<Map<string, UsuarioResumo>> {
    return this.identidade.mapaPorIds(ids);
  }
}
