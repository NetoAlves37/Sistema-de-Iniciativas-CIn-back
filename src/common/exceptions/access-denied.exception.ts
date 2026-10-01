import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code.enum';

export class AccessDeniedException extends AppException {
  constructor(message = 'Acesso negado.') {
    super(ErrorCode.ACCESS_DENIED, message, HttpStatus.FORBIDDEN);
  }
}
