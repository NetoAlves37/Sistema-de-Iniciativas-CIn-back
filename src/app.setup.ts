import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Configuração HTTP da aplicação (prefixo, versionamento, CORS, filtro e envelope).
 * Compartilhada por `main.ts` e pelos testes e2e, para testar a mesma configuração
 * que roda em produção.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.get('API_PREFIX', 'api'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableCors({ origin: configService.getOrThrow<string[]>('cors.origins'), credentials: true });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
}

/** Monta o Swagger e devolve o documento OpenAPI (usado também por `npm run openapi:export`). */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const configService = app.get(ConfigService);

  const swaggerBuilder = new DocumentBuilder()
    .setTitle(configService.get('swagger.title', 'Sistema de Iniciativas - CIn API'))
    .setDescription(configService.get('swagger.description', 'API documentation'))
    .setVersion(configService.get('swagger.version', '1.0.0'))
    .addBearerAuth();

  const authServerUrl = configService.get<string>('keycloak.authServerUrl');
  const realm = configService.get<string>('keycloak.realm');
  if (authServerUrl && realm) {
    const issuer = `${authServerUrl.replace(/\/$/, '')}/realms/${realm}`;
    swaggerBuilder.addOAuth2({
      type: 'oauth2',
      flows: {
        password: {
          tokenUrl: `${issuer}/protocol/openid-connect/token`,
          authorizationUrl: `${issuer}/protocol/openid-connect/auth`,
          scopes: {},
        },
      },
    });
  }

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerBuilder.build()));
  SwaggerModule.setup(configService.get('swagger.path', 'api/docs'), app, document);
  return document;
}
