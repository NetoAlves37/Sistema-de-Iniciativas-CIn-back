import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { IDENTITY_SOURCE } from './identity/identity-source.interface';
import { KeycloakIdentitySource } from './identity/keycloak.identity-source';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: IDENTITY_SOURCE, useClass: KeycloakIdentitySource },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
