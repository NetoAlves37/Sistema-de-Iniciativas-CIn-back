import type { AccessRole } from './access-role.enum';

/** Perfil de exibição do usuário, derivado do token. */
export type PerfilCode = 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN';

/**
 * Identidade extraída do token. Só carrega o necessário (RNF-01): o e-mail do
 * usuário nunca é lido nem repassado.
 */
export interface CurrentUser {
  /** `sub` do token. */
  userId: string;
  nome: string;
  perfil: PerfilCode;
  /** Role de maior precedência: ADMIN > COMITE > USER. */
  role: AccessRole;
  roles: AccessRole[];
}
