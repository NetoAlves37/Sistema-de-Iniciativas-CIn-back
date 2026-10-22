import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { DomainError, type TipoErroDominio, ValidacaoError } from '@/shared/domain/domain-error';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../exceptions/error-code.enum';
import type { ProblemDetails } from './problem-details.dto';

const PROBLEM_TYPE_BASE = 'https://sistema-de-iniciativas-cin.example/problems';

const ERROR_CODE_TITLE: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_FAILED]: 'Dados inválidos',
  [ErrorCode.NOT_FOUND]: 'Recurso não encontrado',
  [ErrorCode.ACCESS_DENIED]: 'Acesso negado',
  [ErrorCode.CONFLICT]: 'Conflito de dados',
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 'Serviço indisponível',
  [ErrorCode.INTERNAL_ERROR]: 'Erro interno do servidor',
};

const DOMAIN_ERROR_HTTP: Record<TipoErroDominio, { status: number; code: ErrorCode }> = {
  validacao: { status: HttpStatus.UNPROCESSABLE_ENTITY, code: ErrorCode.VALIDATION_FAILED },
  proibido: { status: HttpStatus.FORBIDDEN, code: ErrorCode.ACCESS_DENIED },
  nao_encontrado: { status: HttpStatus.NOT_FOUND, code: ErrorCode.NOT_FOUND },
  conflito: { status: HttpStatus.CONFLICT, code: ErrorCode.CONFLICT },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, detail, errors } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const problem: ProblemDetails = {
      type: `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replace(/_/g, '-')}`,
      title: ERROR_CODE_TITLE[code],
      status,
      detail,
      instance: request.url,
      code,
      timestamp: new Date().toISOString(),
      ...(errors ? { errors } : {}),
    };

    response.status(status).header('Content-Type', 'application/problem+json').json(problem);
  }

  private resolve(exception: unknown): {
    status: number;
    code: ErrorCode;
    detail: string;
    errors?: Record<string, string[]>;
  } {
    if (exception instanceof DomainError) {
      return this.fromDomainError(exception);
    }

    if (exception instanceof ZodError) {
      return this.fromZodError(exception);
    }

    if (exception instanceof ZodValidationException) {
      return this.fromZodError(exception.getZodError() as ZodError);
    }

    if (exception instanceof AppException) {
      const { message } = exception.getResponse() as { message: string };
      return { status: exception.getStatus(), code: exception.getErrorCode(), detail: message };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : ((body as { message?: string }).message ?? exception.message);
      return { status, code: this.mapStatusToErrorCode(status), detail };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      detail: 'Erro interno do servidor.',
    };
  }

  /**
   * Traduz um erro de domínio para HTTP pela categoria (`tipo`): o domínio não conhece HTTP,
   * e cada módulo só declara a categoria dos próprios erros. O `detail` é a mensagem em
   * português do erro, pronta para a tela; erros de validação trazem `errors` por campo.
   */
  private fromDomainError(error: DomainError) {
    const { status, code } = DOMAIN_ERROR_HTTP[error.tipo];
    const errors =
      error instanceof ValidacaoError
        ? Object.fromEntries(Object.entries(error.campos).map(([campo, msg]) => [campo, [msg]]))
        : undefined;
    return { status, code, detail: error.message, ...(errors ? { errors } : {}) };
  }

  private fromZodError(error: ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.errors) {
      const field = issue.path.join('.') || 'general';
      errors[field] ??= [];
      errors[field].push(issue.message);
    }
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.VALIDATION_FAILED,
      detail: 'Um ou mais campos precisam ser corrigidos.',
      errors,
    };
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.FORBIDDEN:
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.ACCESS_DENIED;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
