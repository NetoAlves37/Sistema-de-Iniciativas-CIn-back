import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { AccessDeniedException } from '@/common/exceptions/access-denied.exception';
import { AccessRole } from '../access-role.enum';
import type { CurrentUser, PerfilCode } from '../current-user.interface';
import type { IdentitySource } from './identity-source.interface';

// Tolerância de relógio (segundos) entre o Keycloak e esta API ao validar exp/iat.
const CLOCK_TOLERANCE_SECONDS = 5;

type KeyResolver = JWTVerifyGetKey;

/**
 * Claims relevantes do access token emitido pelo Keycloak.
 * `realm_access.roles` carrega as roles de realm. O e-mail não é lido (RNF-01).
 */
export interface KeycloakTokenPayload extends JWTPayload {
  sub?: string;
  // `azp` (authorized party) = client que solicitou o token. O Keycloak costuma
  // colocar o clientId aqui e deixar `aud` como "account", então validamos os dois.
  azp?: string;
  name?: string;
  preferred_username?: string;
  /** Atributo de usuário `perfil` (`aluno` ou `professor`), enviado por protocol mapper. */
  perfil?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Mapeia roles de realm do Keycloak para as roles internas (AccessRole).
 * A chave é o nome da role no Keycloak; o valor é a role do sistema.
 */
const REALM_ROLE_TO_ACCESS_ROLE: Record<string, AccessRole> = {
  'sys_sistema-de-iniciativas-cin-admin': AccessRole.ADMIN,
  'sys_sistema-de-iniciativas-cin-users': AccessRole.USER,
  'sys_sistema-de-iniciativas-cin-comite': AccessRole.COMITE,
};

const NOME_PADRAO = 'Membro da comunidade';

@Injectable()
export class KeycloakIdentitySource implements IdentitySource {
  private readonly logger = new Logger(KeycloakIdentitySource.name);
  private keys?: KeyResolver;
  private issuer?: string;

  constructor(protected readonly configService: ConfigService) {}

  /**
   * Resolve as chaves de verificação do token. Ponto de extensão: os testes
   * sobrescrevem este método para usar um JWKS local em vez do Keycloak.
   */
  protected createKeyResolver(issuer: string): KeyResolver {
    return createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`), {
      // Revalida periodicamente o key set (rotação de chaves do Keycloak).
      cacheMaxAge: this.configService.get<number>('keycloak.jwksCacheMaxAge'),
      // Falha rápido se o endpoint JWKS não responder, em vez de travar a requisição.
      timeoutDuration: this.configService.get<number>('keycloak.jwksTimeout'),
    });
  }

  /**
   * Inicializa issuer e chaves sob demanda (na primeira validação de token), evitando
   * I/O de rede na construção do provider durante o bootstrap do módulo. A presença
   * da configuração já foi garantida no boot por `validateEnv`.
   */
  private ensureInitialized(): KeyResolver {
    if (this.keys) {
      return this.keys;
    }
    const authServerUrl = this.configService.getOrThrow<string>('keycloak.authServerUrl');
    const realm = this.configService.getOrThrow<string>('keycloak.realm');

    this.issuer = `${authServerUrl.replace(/\/$/, '')}/realms/${realm}`;
    this.keys = this.createKeyResolver(this.issuer);
    return this.keys;
  }

  /**
   * Verifica assinatura, issuer e validade do token. Ponto de extensão: o
   * `TestIdentitySource` troca a verificação por HS256 com segredo local.
   */
  protected async verifyToken(token: string): Promise<KeycloakTokenPayload> {
    const keys = this.ensureInitialized();
    // Não usamos a opção `audience` do jose: o Keycloak costuma colocar o clientId
    // em `azp`, não em `aud`. A audiência é validada manualmente em `extract`.
    const result = await jwtVerify<KeycloakTokenPayload>(token, keys, {
      issuer: this.issuer,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    return result.payload;
  }

  async extract(req: Request): Promise<CurrentUser | null> {
    const token = this.readBearerToken(req);
    if (!token) {
      return null;
    }

    let payload: KeycloakTokenPayload;
    try {
      payload = await this.verifyToken(token);
    } catch (error) {
      this.logger.debug(`Falha ao verificar o token: ${(error as Error).message}`);
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token sem identificador de usuário.');
    }

    if (!this.hasValidAudience(payload)) {
      throw new AccessDeniedException('Token emitido para outro cliente.');
    }

    const roles = this.resolveRoles(payload);
    if (roles.length === 0) {
      throw new AccessDeniedException('Usuário sem papel reconhecido pelo sistema.');
    }
    const role = this.resolveRole(roles);

    return {
      userId: payload.sub,
      nome: this.resolveNome(payload),
      perfil: this.resolvePerfil(payload, role),
      role,
      roles,
    };
  }

  /**
   * Aceita o token se o clientId configurado aparecer em `aud` (string ou array)
   * ou em `azp`. Se nenhum clientId estiver configurado, a audiência não é validada.
   */
  protected hasValidAudience(payload: KeycloakTokenPayload): boolean {
    const clientId = this.configService.get<string>('keycloak.clientId') || undefined;
    if (!clientId) {
      return true;
    }
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
    return audiences.includes(clientId) || payload.azp === clientId;
  }

  private readBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return null;
    }
    return value;
  }

  private resolveRoles(payload: KeycloakTokenPayload): AccessRole[] {
    const realmRoles = payload.realm_access?.roles ?? [];
    const matched = realmRoles
      .map((r) => REALM_ROLE_TO_ACCESS_ROLE[r])
      .filter((r): r is AccessRole => r !== undefined);
    return [...new Set(matched)];
  }

  /** Precedência por privilégio: ADMIN > COMITE > USER. */
  private resolveRole(roles: AccessRole[]): AccessRole {
    if (roles.includes(AccessRole.ADMIN)) return AccessRole.ADMIN;
    if (roles.includes(AccessRole.COMITE)) return AccessRole.COMITE;
    return AccessRole.USER;
  }

  private resolveNome(payload: KeycloakTokenPayload): string {
    return payload.name?.trim() || payload.preferred_username?.trim() || NOME_PADRAO;
  }

  /**
   * ADMIN e COMITE vêm da role. ALUNO ou PROFESSOR vem do atributo `perfil`, com ALUNO
   * como padrão.
   */
  private resolvePerfil(payload: KeycloakTokenPayload, role: AccessRole): PerfilCode {
    if (role === AccessRole.ADMIN) return 'ADMIN';
    if (role === AccessRole.COMITE) return 'COMITE';
    return payload.perfil?.trim().toLowerCase() === 'professor' ? 'PROFESSOR' : 'ALUNO';
  }
}
