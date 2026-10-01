import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE ?? 'Sistema de Iniciativas - CIn API',
  description:
    process.env.SWAGGER_DESCRIPTION ?? 'API documentation for sistema-de-iniciativas-cin',
  version: process.env.SWAGGER_VERSION ?? '1.0.0',
  path: process.env.SWAGGER_PATH ?? 'api/docs',
}));
