import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-code.enum';

export class AppException extends HttpException {
  constructor(
    private readonly code: ErrorCode,
    message: string,
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message, status);
  }

  getErrorCode(): ErrorCode {
    return this.code;
  }

  getResponse() {
    return {
      code: this.code,
      message: super.getResponse(),
    };
  }
}
