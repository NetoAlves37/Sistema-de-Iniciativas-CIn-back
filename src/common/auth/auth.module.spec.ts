import type { ConfigService } from '@nestjs/config';
import { createIdentitySource } from './auth.module';
import { KeycloakIdentitySource } from './identity/keycloak.identity-source';
import { TestIdentitySource } from './identity/test.identity-source';

const config = (values: Record<string, string>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('createIdentitySource', () => {
  it('usa o TestIdentitySource só com NODE_ENV=test e AUTH_MODE=test', () => {
    const source = createIdentitySource(
      config({ NODE_ENV: 'test', AUTH_MODE: 'test', TEST_JWT_SECRET: 'segredo' }),
    );
    expect(source).toBeInstanceOf(TestIdentitySource);
  });

  it.each([
    'development',
    'production',
    undefined,
  ])('NUNCA registra o TestIdentitySource com NODE_ENV=%s, mesmo com AUTH_MODE=test', (nodeEnv) => {
    const values: Record<string, string> = { AUTH_MODE: 'test', TEST_JWT_SECRET: 'segredo' };
    if (nodeEnv) values.NODE_ENV = nodeEnv;
    const source = createIdentitySource(config(values));
    expect(source).toBeInstanceOf(KeycloakIdentitySource);
    expect(source).not.toBeInstanceOf(TestIdentitySource);
  });

  it('em NODE_ENV=test sem AUTH_MODE=test, continua no Keycloak', () => {
    expect(createIdentitySource(config({ NODE_ENV: 'test' }))).toBeInstanceOf(
      KeycloakIdentitySource,
    );
  });
});
