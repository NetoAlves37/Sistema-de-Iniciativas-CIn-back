import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { IDENTITY_SOURCE, type IdentitySource } from './identity/identity-source.interface';
import { KeycloakIdentitySource } from './identity/keycloak.identity-source';
import { TestIdentitySource } from './identity/test.identity-source';

/**
 * Escolhe a origem de identidade. O modo de teste só vale com `NODE_ENV=test` **e**
 * `AUTH_MODE=test`; em qualquer outro caso (inclusive `AUTH_MODE=test` fora de teste,
 * que `validateEnv` já recusa no boot) o provider é o Keycloak.
 */
export function createIdentitySource(config: ConfigService): IdentitySource {
  const modoTeste = config.get('NODE_ENV') === 'test' && config.get('AUTH_MODE') === 'test';
  return modoTeste ? new TestIdentitySource(config) : new KeycloakIdentitySource(config);
}

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: IDENTITY_SOURCE, useFactory: createIdentitySource, inject: [ConfigService] },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
