import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessRole } from '@/common/auth/access-role.enum';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { ROLES_KEY } from '@/common/auth/decorators/roles.decorator';
import { RolesGuard } from '@/common/auth/guards/roles.guard';
import { AccessDeniedException } from '@/common/exceptions/access-denied.exception';
import { ErrorCode } from '@/common/exceptions/error-code.enum';
import { AvaliacaoController } from '@/modules/avaliacao/presentation/http/avaliacao.controller';

/* ===========================================================================
 * US02 - ACESSO NEGADO A QUEM NÃO É DO COMITÊ NEM ADMINISTRADOR (lacuna L7)
 *
 * O bloqueio não está nos casos de uso: o AvaliacaoController declara
 * @Roles(COMITE, ADMIN) e o RolesGuard aplica essa regra. Estes testes usam o
 * controller REAL (para ler o que ele exige) e o guard REAL, sem HTTP e sem banco.
 * ========================================================================= */

type Rota = 'decidir' | 'fila';

const contextoDe = (rota: Rota, user?: CurrentUser): ExecutionContext =>
  ({
    getHandler: () => AvaliacaoController.prototype[rota],
    getClass: () => AvaliacaoController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const usuario = (...roles: AccessRole[]): CurrentUser => ({
  userId: 'u1',
  nome: 'Teste',
  perfil: 'ALUNO',
  role: roles[0],
  roles,
});

const guard = new RolesGuard(new Reflector());

describe('US02 - acesso negado: o que o controller de avaliação exige (L7)', () => {
  it.each(['decidir', 'fila'] as const)(
    'US02 rota %s | Partição de Equivalência (perfis permitidos) | exige COMITE ou ADMIN',
    (rota) => {
      // Requisito: US02 - Impedir avaliação por usuário sem permissão
      // Técnica: Partição de Equivalência (configuração do controller real)
      // Esperado: as roles exigidas são exatamente COMITE e ADMIN
      const exigidas = new Reflector().getAllAndOverride<AccessRole[]>(ROLES_KEY, [
        AvaliacaoController.prototype[rota],
        AvaliacaoController,
      ]);
      expect(exigidas).toEqual([AccessRole.COMITE, AccessRole.ADMIN]);
    },
  );
});

describe('US02 - acesso negado: o guard decide por perfil (L7)', () => {
  const casos: Array<[Rota, string, AccessRole[], boolean]> = [
    ['decidir', 'aluno ou professor (só USER)', [AccessRole.USER], false],
    ['decidir', 'membro do comitê', [AccessRole.USER, AccessRole.COMITE], true],
    ['decidir', 'administrador', [AccessRole.ADMIN, AccessRole.USER], true],
    ['fila', 'aluno ou professor (só USER)', [AccessRole.USER], false],
    ['fila', 'membro do comitê', [AccessRole.USER, AccessRole.COMITE], true],
    ['fila', 'administrador', [AccessRole.ADMIN, AccessRole.USER], true],
  ];

  it.each(casos)(
    'US02 rota %s com %s | Partição de Equivalência (perfil do usuário) | permitido=%s',
    (rota, _perfil, roles, permitido) => {
      // Requisito: US02 - Impedir avaliação por usuário sem permissão
      // Técnica: Partição de Equivalência (USER, COMITE, ADMIN)
      // Esperado: comitê e administrador passam; quem só tem USER recebe AccessDeniedException
      const executar = () => guard.canActivate(contextoDe(rota, usuario(...roles)));
      if (permitido) expect(executar()).toBe(true);
      else expect(executar).toThrow(AccessDeniedException);
    },
  );

  it('US02 acesso negado | Partição de Equivalência (perfil sem permissão) | 403, código e mensagem', () => {
    // Requisito: US02 - Impedir avaliação por usuário sem permissão ("acesso negado")
    // Técnica: Partição de Equivalência (USER tentando decidir)
    // Esperado: AccessDeniedException com status 403, código ACCESS_DENIED e a mensagem de negação
    let erro: unknown;
    try {
      guard.canActivate(contextoDe('decidir', usuario(AccessRole.USER)));
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(AccessDeniedException);
    const negado = erro as AccessDeniedException;
    expect(negado.getStatus()).toBe(403);
    expect(negado.getErrorCode()).toBe(ErrorCode.ACCESS_DENIED);
    expect(negado.message).toBe('Você não tem permissão para acessar este recurso.');
  });

  it('US02 requisição sem usuário | Partição de Equivalência (não autenticado) | acesso negado', () => {
    // Requisito: US02 - Impedir avaliação por usuário sem permissão
    // Técnica: Partição de Equivalência (nenhum usuário na requisição)
    // Esperado: AccessDeniedException
    expect(() => guard.canActivate(contextoDe('decidir', undefined))).toThrow(
      AccessDeniedException,
    );
  });
});
