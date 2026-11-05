/**
 * Valida variáveis de ambiente no boot. Falha cedo (na inicialização) em vez de
 * deixar erros de configuração aparecerem só na primeira requisição em produção.
 *
 * Sem dependência extra (Joi/zod): checagens explícitas sobre o objeto de env.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const emTeste = config.NODE_ENV === 'test';

  // O Keycloak é obrigatório fora de teste: o AuthGuard é global e fail-closed, então sem
  // ele a API não consegue autenticar ninguém. Melhor falhar no boot do que devolver 500.
  if (!emTeste) {
    for (const key of ['KEYCLOAK_AUTH_SERVER_URL', 'KEYCLOAK_REALM']) {
      if (!config[key]) {
        errors.push(`${key} é obrigatório (veja .env.example e setup/README.md).`);
      }
    }
  }

  for (const key of ['KEYCLOAK_JWKS_CACHE_MAX_AGE', 'KEYCLOAK_JWKS_TIMEOUT']) {
    const raw = config[key];
    if (raw !== undefined && Number.isNaN(Number.parseInt(raw as string, 10))) {
      errors.push(`${key} deve ser um número inteiro (ms).`);
    }
  }

  // Modo de autenticação: `test` só existe com NODE_ENV=test e exige o segredo do JWT.
  const authMode = config.AUTH_MODE;
  if (authMode !== undefined && authMode !== '' && authMode !== 'keycloak' && authMode !== 'test') {
    errors.push('AUTH_MODE deve ser "keycloak" ou "test".');
  }
  if (authMode === 'test') {
    if (!emTeste) {
      errors.push('AUTH_MODE=test só é permitido com NODE_ENV=test.');
    }
    if (!config.TEST_JWT_SECRET) {
      errors.push('TEST_JWT_SECRET é obrigatório quando AUTH_MODE=test.');
    }
  }

  // Prazos em dias (aceita fração, ex.: 0.5 = 12 horas).
  for (const key of ['PRAZO_REFINAMENTO_DIAS', 'PRAZO_VOTACAO_DIAS']) {
    const raw = config[key];
    if (raw !== undefined && raw !== '') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        errors.push(`${key} deve ser um número maior que zero (dias).`);
      }
    }
  }

  const cron = config.TRANSICOES_CRON;
  if (typeof cron === 'string' && cron.trim() !== '') {
    const fields = cron.trim().split(/\s+/).length;
    if (fields !== 5 && fields !== 6) {
      errors.push('TRANSICOES_CRON deve ser uma expressão cron com 5 ou 6 campos.');
    }
  }

  const timezone = config.APP_TIMEZONE;
  if (typeof timezone === 'string' && timezone.trim() !== '') {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
    } catch {
      errors.push(`APP_TIMEZONE "${timezone}" não é um fuso horário IANA válido.`);
    }
  }

  // Em produção, as origens permitidas precisam ser explícitas.
  if (config.NODE_ENV === 'production' && !config.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS é obrigatório em produção (lista de origens separada por vírgula).');
  }

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
