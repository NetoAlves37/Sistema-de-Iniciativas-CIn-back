import { registerAs } from '@nestjs/config';

const DEFAULT_DEV_ORIGINS = ['http://localhost:5173'];

/**
 * Origens autorizadas a chamar a API pelo navegador. `CORS_ORIGINS` é uma lista
 * separada por vírgula; sem ela, só o front de desenvolvimento é aceito
 * (em produção `validateEnv` exige a variável).
 */
export default registerAs('cors', () => {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return { origins: origins.length > 0 ? origins : DEFAULT_DEV_ORIGINS };
});
