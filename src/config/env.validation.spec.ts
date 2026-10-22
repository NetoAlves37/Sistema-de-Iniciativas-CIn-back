import { validateEnv } from './env.validation';

const base = {
  KEYCLOAK_AUTH_SERVER_URL: 'http://localhost:8080/auth',
  KEYCLOAK_REALM: 'Local',
};

describe('validateEnv', () => {
  it('aceita a configuração mínima', () => {
    expect(validateEnv(base)).toEqual(base);
  });

  it('falha no boot quando o Keycloak não está configurado', () => {
    expect(() => validateEnv({})).toThrow(/KEYCLOAK_AUTH_SERVER_URL é obrigatório/);
    expect(() => validateEnv({})).toThrow(/KEYCLOAK_REALM é obrigatório/);
    expect(() => validateEnv({ KEYCLOAK_REALM: 'Local' })).toThrow(/KEYCLOAK_AUTH_SERVER_URL/);
  });

  it('não exige o Keycloak em NODE_ENV=test', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('valida os timeouts do JWKS', () => {
    expect(() => validateEnv({ ...base, KEYCLOAK_JWKS_TIMEOUT: 'abc' })).toThrow(
      /KEYCLOAK_JWKS_TIMEOUT/,
    );
  });

  it('AUTH_MODE aceita keycloak e test; qualquer outro valor falha', () => {
    expect(() => validateEnv({ ...base, AUTH_MODE: 'keycloak' })).not.toThrow();
    expect(() => validateEnv({ ...base, AUTH_MODE: 'basic' })).toThrow(/AUTH_MODE/);
  });

  it('AUTH_MODE=test só com NODE_ENV=test e com TEST_JWT_SECRET', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'test', AUTH_MODE: 'test', TEST_JWT_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'development', AUTH_MODE: 'test', TEST_JWT_SECRET: 'x' }),
    ).toThrow(/só é permitido com NODE_ENV=test/);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', AUTH_MODE: 'test', TEST_JWT_SECRET: 'x' }),
    ).toThrow(/só é permitido com NODE_ENV=test/);
    expect(() => validateEnv({ NODE_ENV: 'test', AUTH_MODE: 'test' })).toThrow(/TEST_JWT_SECRET/);
  });

  it('valida os prazos em dias (maior que zero, aceita fração)', () => {
    expect(() => validateEnv({ ...base, PRAZO_REFINAMENTO_DIAS: '0.0035' })).not.toThrow();
    expect(() => validateEnv({ ...base, PRAZO_REFINAMENTO_DIAS: '0' })).toThrow(
      /PRAZO_REFINAMENTO_DIAS/,
    );
    expect(() => validateEnv({ ...base, PRAZO_VOTACAO_DIAS: '-1' })).toThrow(/PRAZO_VOTACAO_DIAS/);
    expect(() => validateEnv({ ...base, PRAZO_VOTACAO_DIAS: 'x' })).toThrow(/PRAZO_VOTACAO_DIAS/);
  });

  it('valida a expressão cron e o fuso horário', () => {
    expect(() => validateEnv({ ...base, TRANSICOES_CRON: '*/1 * * * *' })).not.toThrow();
    expect(() => validateEnv({ ...base, TRANSICOES_CRON: '*/5 * * * * *' })).not.toThrow();
    expect(() => validateEnv({ ...base, TRANSICOES_CRON: '* * * *' })).toThrow(/TRANSICOES_CRON/);
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'America/Recife' })).not.toThrow();
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Marte/Olympus' })).toThrow(/APP_TIMEZONE/);
  });

  it('exige CORS_ORIGINS em produção, mas não em desenvolvimento', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'development' })).not.toThrow();
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://x.cin.ufpe.br' }),
    ).not.toThrow();
  });

  it('reúne todos os erros numa só mensagem', () => {
    expect(() => validateEnv({ PRAZO_VOTACAO_DIAS: '0' })).toThrow(
      /KEYCLOAK_REALM[\s\S]*PRAZO_VOTACAO_DIAS/,
    );
  });
});
