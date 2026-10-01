/**
 * Valida variáveis de ambiente no boot. Falha cedo (na inicialização) em vez de
 * deixar erros de configuração aparecerem só na primeira requisição em produção.
 *
 * Sem dependência extra (Joi/zod): checagens explícitas sobre o objeto de env.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  // O Keycloak é opcional: só valida se KEYCLOAK_AUTH_SERVER_URL ou KEYCLOAK_REALM
  // foram definidos, forçando a configuração completa nesse caso.
  const keycloakConfigured = Boolean(config.KEYCLOAK_AUTH_SERVER_URL || config.KEYCLOAK_REALM);
  if (keycloakConfigured) {
    for (const key of ['KEYCLOAK_AUTH_SERVER_URL', 'KEYCLOAK_REALM']) {
      if (!config[key]) {
        errors.push(`${key} é obrigatório quando o Keycloak está configurado.`);
      }
    }
  }

  for (const key of ['KEYCLOAK_JWKS_CACHE_MAX_AGE', 'KEYCLOAK_JWKS_TIMEOUT']) {
    const raw = config[key];
    if (raw !== undefined && Number.isNaN(Number.parseInt(raw as string, 10))) {
      errors.push(`${key} deve ser um número inteiro (ms).`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
