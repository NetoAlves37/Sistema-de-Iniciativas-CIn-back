import { SignJWT } from 'jose';
import { type NomeUsuarioTeste, PREFIXO_ROLE, USUARIOS_TESTE } from './usuarios-teste';

export interface OpcoesToken {
  /** Substitui o `sub` do usuário de teste. */
  sub?: string;
  nome?: string;
  perfil?: string;
  /** Roles de realm completas (com prefixo). Substitui as do usuário. */
  roles?: string[];
  expiraEm?: string;
  secret?: string;
}

const secretPadrao = () => process.env.TEST_JWT_SECRET ?? '';

/**
 * Gera um JWT HS256 aceito pelo `TestIdentitySource` (`NODE_ENV=test` e `AUTH_MODE=test`),
 * com as mesmas claims que o Keycloak emite: `sub`, `name`, `perfil` e `realm_access.roles`.
 */
export async function tokenDe(
  usuario: NomeUsuarioTeste,
  opcoes: OpcoesToken = {},
): Promise<string> {
  const dados = USUARIOS_TESTE[usuario];
  const atributoPerfil = 'atributoPerfil' in dados ? dados.atributoPerfil : undefined;
  return new SignJWT({
    name: opcoes.nome ?? dados.nome,
    perfil: opcoes.perfil ?? atributoPerfil,
    realm_access: {
      roles: opcoes.roles ?? dados.roles.map((role) => `${PREFIXO_ROLE}${role}`),
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opcoes.sub ?? dados.id)
    .setIssuedAt()
    .setExpirationTime(opcoes.expiraEm ?? '1h')
    .sign(new TextEncoder().encode(opcoes.secret ?? secretPadrao()));
}

/** Token de um usuário que não existe em `USUARIOS_TESTE` (por exemplo, sem nenhuma role). */
export async function tokenAvulso(
  sub: string,
  roles: string[],
  opcoes: Omit<OpcoesToken, 'sub' | 'roles'> = {},
): Promise<string> {
  return new SignJWT({
    name: opcoes.nome ?? 'Avulso',
    perfil: opcoes.perfil,
    realm_access: { roles },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(opcoes.expiraEm ?? '1h')
    .sign(new TextEncoder().encode(opcoes.secret ?? secretPadrao()));
}
