import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AccessRole } from '../access-role.enum';
import type { CurrentUser } from '../current-user.interface';
import { RolesGuard } from './roles.guard';

function contexto(user?: CurrentUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guard(required?: AccessRole[]): RolesGuard {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const usuario = (...roles: AccessRole[]): CurrentUser => ({
  userId: 'u1',
  nome: 'Teste',
  perfil: 'ALUNO',
  role: roles[0],
  roles,
});

describe('RolesGuard', () => {
  it('libera quando a rota não exige roles', () => {
    expect(guard(undefined).canActivate(contexto(usuario(AccessRole.USER)))).toBe(true);
    expect(guard([]).canActivate(contexto(usuario(AccessRole.USER)))).toBe(true);
  });

  it('libera quando o usuário tem ao menos uma das roles exigidas', () => {
    const g = guard([AccessRole.COMITE, AccessRole.ADMIN]);
    expect(g.canActivate(contexto(usuario(AccessRole.USER, AccessRole.COMITE)))).toBe(true);
    expect(g.canActivate(contexto(usuario(AccessRole.ADMIN, AccessRole.USER)))).toBe(true);
  });

  it('nega (403) quem não tem a role exigida', () => {
    const g = guard([AccessRole.COMITE, AccessRole.ADMIN]);
    expect(() => g.canActivate(contexto(usuario(AccessRole.USER)))).toThrow(
      'Você não tem permissão para acessar este recurso.',
    );
  });

  it('nega quando não há usuário na requisição', () => {
    expect(() => guard([AccessRole.COMITE]).canActivate(contexto(undefined))).toThrow();
  });
});
