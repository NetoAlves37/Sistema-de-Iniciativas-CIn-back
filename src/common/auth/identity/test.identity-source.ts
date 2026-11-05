import { ConfigService } from '@nestjs/config';
import { type JWTVerifyGetKey, jwtVerify } from 'jose';
import { KeycloakIdentitySource, type KeycloakTokenPayload } from './keycloak.identity-source';

/**
 * Identity source **só para testes**: valida JWT HS256 assinado com `TEST_JWT_SECRET`,
 * reaproveitando toda a leitura de claims, roles e perfil do `KeycloakIdentitySource`.
 * `AuthModule` só o registra quando `NODE_ENV=test` e `AUTH_MODE=test`.
 */
export class TestIdentitySource extends KeycloakIdentitySource {
  private readonly secret: Uint8Array;

  constructor(config: ConfigService) {
    super(config);
    this.secret = new TextEncoder().encode(config.getOrThrow<string>('TEST_JWT_SECRET'));
  }

  protected createKeyResolver(): JWTVerifyGetKey {
    throw new Error('TestIdentitySource não usa JWKS.');
  }

  /** Os tokens de teste não passam por um client do Keycloak: não há audiência a validar. */
  protected hasValidAudience(): boolean {
    return true;
  }

  protected async verifyToken(token: string): Promise<KeycloakTokenPayload> {
    const { payload } = await jwtVerify<KeycloakTokenPayload>(token, this.secret, {
      algorithms: ['HS256'],
    });
    return payload;
  }
}
