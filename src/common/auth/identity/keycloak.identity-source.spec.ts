import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';
import { AccessRole } from '../access-role.enum';
import { KeycloakIdentitySource } from './keycloak.identity-source';
import { TestIdentitySource } from './test.identity-source';

const ISSUER = 'http://keycloak.test/auth/realms/Local';
const CLIENT_ID = 'sistema-de-iniciativas-cin-back';
const ROLE_USERS = 'sys_sistema-de-iniciativas-cin-users';
const ROLE_ADMIN = 'sys_sistema-de-iniciativas-cin-admin';
const ROLE_COMITE = 'sys_sistema-de-iniciativas-cin-comite';

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

class KeycloakLocal extends KeycloakIdentitySource {
  protected createKeyResolver(): JWTVerifyGetKey {
    return jwks;
  }
}

function configService(clientId = CLIENT_ID, extra: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'keycloak.authServerUrl': 'http://keycloak.test/auth',
    'keycloak.realm': 'Local',
    'keycloak.clientId': clientId,
    ...extra,
  };
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

interface TokenOptions {
  sub?: string | null;
  name?: string;
  preferred_username?: string;
  perfil?: string;
  roles?: string[];
  azp?: string;
  aud?: string | string[];
  issuer?: string;
  expiresIn?: string;
}

async function token(options: TokenOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = {
    name: options.name ?? 'Ana Souza',
    preferred_username: options.preferred_username,
    perfil: options.perfil,
    azp: options.azp ?? CLIENT_ID,
    realm_access: { roles: options.roles ?? [ROLE_USERS] },
    // Não deve ser lido nem repassado (RNF-01).
    email: 'ana@dev.local',
  };
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m');
  if (options.sub !== null) jwt = jwt.setSubject(options.sub ?? 'user-1');
  if (options.aud) jwt = jwt.setAudience(options.aud);
  return jwt.sign(privateKey);
}

const request = (bearer?: string) =>
  ({ headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }) as unknown as Request;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256', use: 'sig' };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

describe('KeycloakIdentitySource', () => {
  const source = () => new KeycloakLocal(configService());

  it('devolve null quando não há header Authorization', async () => {
    expect(await source().extract(request())).toBeNull();
  });

  it('devolve null quando o esquema não é Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' } } as unknown as Request;
    expect(await source().extract(req)).toBeNull();
  });

  it('extrai id, nome, perfil e roles de um token válido, sem expor o e-mail', async () => {
    const user = await source().extract(request(await token({ perfil: 'aluno' })));
    expect(user).toEqual({
      userId: 'user-1',
      nome: 'Ana Souza',
      perfil: 'ALUNO',
      role: AccessRole.USER,
      roles: [AccessRole.USER],
    });
    expect(JSON.stringify(user)).not.toContain('@');
  });

  it('perfil "professor" no atributo vira PROFESSOR', async () => {
    const user = await source().extract(request(await token({ perfil: 'Professor' })));
    expect(user?.perfil).toBe('PROFESSOR');
  });

  it('sem atributo perfil, o padrão é ALUNO', async () => {
    const user = await source().extract(request(await token()));
    expect(user?.perfil).toBe('ALUNO');
  });

  it('a role do comitê define o perfil COMITE, mesmo com atributo perfil', async () => {
    const user = await source().extract(
      request(await token({ perfil: 'professor', roles: [ROLE_USERS, ROLE_COMITE] })),
    );
    expect(user?.perfil).toBe('COMITE');
    expect(user?.role).toBe(AccessRole.COMITE);
    expect(user?.roles).toEqual(expect.arrayContaining([AccessRole.USER, AccessRole.COMITE]));
  });

  it('a role de admin define o perfil ADMIN e vence o comitê (ADMIN > COMITE > USER)', async () => {
    const user = await source().extract(
      request(await token({ roles: [ROLE_USERS, ROLE_COMITE, ROLE_ADMIN] })),
    );
    expect(user?.perfil).toBe('ADMIN');
    expect(user?.role).toBe(AccessRole.ADMIN);
    expect(user?.roles).toEqual(
      expect.arrayContaining([AccessRole.ADMIN, AccessRole.COMITE, AccessRole.USER]),
    );
  });

  it('usa preferred_username quando não há name, e um padrão quando não há nenhum', async () => {
    const porLogin = await source().extract(
      request(await token({ name: '', preferred_username: 'ana' })),
    );
    expect(porLogin?.nome).toBe('ana');
    const anonimo = await source().extract(request(await token({ name: '' })));
    expect(anonimo?.nome).toBe('Membro da comunidade');
  });

  it('403 quando o usuário não tem nenhuma role do sistema', async () => {
    await expect(
      source().extract(request(await token({ roles: ['offline_access'] }))),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('401 para token expirado, de outro issuer ou sem sub', async () => {
    await expect(
      source().extract(request(await token({ expiresIn: '-10m' }))),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      source().extract(request(await token({ issuer: 'http://outro/realms/X' }))),
    ).rejects.toMatchObject({ status: 401 });
    await expect(source().extract(request(await token({ sub: null })))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('401 para token com assinatura de outra chave', async () => {
    const outra = await generateKeyPair('RS256');
    const forjado = await new SignJWT({ realm_access: { roles: [ROLE_USERS] } })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(ISSUER)
      .setSubject('user-1')
      .setExpirationTime('5m')
      .sign(outra.privateKey);
    await expect(source().extract(request(forjado))).rejects.toMatchObject({ status: 401 });
  });

  it('403 quando o token foi emitido para outro client', async () => {
    await expect(
      source().extract(request(await token({ azp: 'outro-client', aud: 'account' }))),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('aceita o clientId em aud quando azp é outro', async () => {
    const user = await source().extract(
      request(await token({ azp: 'sistema-de-iniciativas-cin-front', aud: [CLIENT_ID] })),
    );
    expect(user?.userId).toBe('user-1');
  });

  it('não valida a audiência quando nenhum clientId está configurado', async () => {
    const semClient = new KeycloakLocal(configService(''));
    const user = await semClient.extract(request(await token({ azp: 'qualquer' })));
    expect(user?.userId).toBe('user-1');
  });
});

describe('TestIdentitySource', () => {
  const SECRET = 'segredo-de-teste-com-tamanho-suficiente';
  const source = () => new TestIdentitySource(configService('', { TEST_JWT_SECRET: SECRET }));

  const hs256 = (claims: Record<string, unknown>, secret = SECRET) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-test')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));

  it('aceita JWT HS256 assinado com o segredo de teste e lê claims como o Keycloak', async () => {
    const user = await source().extract(
      request(
        await hs256({ name: 'Carla Menezes', realm_access: { roles: [ROLE_USERS, ROLE_COMITE] } }),
      ),
    );
    expect(user).toMatchObject({ userId: 'u-test', perfil: 'COMITE', role: AccessRole.COMITE });
  });

  it('rejeita assinatura com outro segredo (401)', async () => {
    const forjado = await hs256(
      { realm_access: { roles: [ROLE_USERS] } },
      'outro-segredo-qualquer-123456789',
    );
    await expect(source().extract(request(forjado))).rejects.toMatchObject({ status: 401 });
  });

  it('rejeita tokens RS256 do Keycloak (401)', async () => {
    await expect(source().extract(request(await token()))).rejects.toMatchObject({ status: 401 });
  });
});
