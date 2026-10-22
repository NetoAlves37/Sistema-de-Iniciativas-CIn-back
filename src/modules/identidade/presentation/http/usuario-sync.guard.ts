import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { IdentidadeFacade } from '../../application/identidade.facade';

/**
 * Roda depois do `AuthGuard`: toda requisição autenticada garante que o usuário do
 * token exista localmente (id, nome, perfil). Assim qualquer módulo pode exibir
 * nomes de autores e comentaristas sem depender de o usuário ter chamado `GET /me`.
 */
@Injectable()
export class UsuarioSyncGuard implements CanActivate {
  constructor(private readonly identidade: IdentidadeFacade) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (user) {
      await this.identidade.garantirUsuario({
        id: user.userId,
        nome: user.nome,
        perfil: user.perfil,
      });
    }
    return true;
  }
}
