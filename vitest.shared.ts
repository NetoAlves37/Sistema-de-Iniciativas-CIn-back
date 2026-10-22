import path from 'node:path';

// Local: carrega o .env. No CI não há .env e as variáveis DB_* vêm do ambiente.
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env
}

export const alias = { '@': path.resolve(__dirname, 'src') };

/** Banco dedicado aos testes de integração e e2e (`<DB_DATABASE>-TEST`), criado e migrado no globalSetup. */
export const TEST_DATABASE = `${process.env.DB_DATABASE ?? 'BD-SICIN'}-TEST`;

export const TEST_DATABASE_URL = (() => {
  const user = encodeURIComponent(process.env.DB_USERNAME ?? 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? 'postgres');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${encodeURIComponent(TEST_DATABASE)}`;
})();

/**
 * Ambiente dos testes de integração e e2e. A autenticação usa o `TestIdentitySource`
 * (JWT HS256, só com NODE_ENV=test e AUTH_MODE=test). O cron de transições fica desligado:
 * os testes chamam `executarAgora()` e controlam o tempo com o `FakeClock`.
 */
export const testEnv = {
  NODE_ENV: 'test',
  AUTH_MODE: 'test',
  TEST_JWT_SECRET: 'segredo-de-teste-do-sistema-de-iniciativas-cin',
  DATABASE_URL: TEST_DATABASE_URL,
  API_PREFIX: 'sistema-de-iniciativas-cin/api',
  CORS_ORIGINS: 'http://localhost:5173',
  PRAZO_REFINAMENTO_DIAS: '3',
  PRAZO_VOTACAO_DIAS: '3',
  APP_TIMEZONE: 'America/Recife',
  TRANSICOES_CRON: '0 0 1 1 *',
};
