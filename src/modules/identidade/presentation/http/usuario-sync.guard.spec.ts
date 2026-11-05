import type { ExecutionContext } from '@nestjs/common';
import type { IdentidadeFacade } from '../../application/identidade.facade';
import { UsuarioSyncGuard } from './usuario-sync.guard';

const contexto = (user: unknown): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('UsuarioSyncGuard', () => {
  it('garante o usuário do token (id, nome e perfil) e libera a requisição', async () => {
    const garantirUsuario = vi.fn().mockResolvedValue(undefined);
    const guard = new UsuarioSyncGuard({ garantirUsuario } as unknown as IdentidadeFacade);

    const liberado = await guard.canActivate(
      contexto({ userId: 'u1', nome: 'Ana', perfil: 'ALUNO', roles: ['USER'] }),
    );

    expect(liberado).toBe(true);
    expect(garantirUsuario).toHaveBeenCalledWith({ id: 'u1', nome: 'Ana', perfil: 'ALUNO' });
  });

  it('em rota pública (sem usuário) não faz nada e libera', async () => {
    const garantirUsuario = vi.fn();
    const guard = new UsuarioSyncGuard({ garantirUsuario } as unknown as IdentidadeFacade);

    expect(await guard.canActivate(contexto(undefined))).toBe(true);
    expect(garantirUsuario).not.toHaveBeenCalled();
  });
});
