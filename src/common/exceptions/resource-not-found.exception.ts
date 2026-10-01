import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code.enum';

export class ResourceNotFoundException extends AppException {
  constructor(resource: string, id?: string) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource}${id ? ` com id "${id}"` : ''} não encontrado(a).`,
      HttpStatus.NOT_FOUND,
    );
  }
}
