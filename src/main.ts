import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.get('API_PREFIX', 'api'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableCors();

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

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

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
