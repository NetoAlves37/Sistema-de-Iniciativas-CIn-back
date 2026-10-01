import type { ArgumentsHost } from '@nestjs/common';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { ResourceNotFoundException } from '../exceptions/resource-not-found.exception';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createMockHost(url = '/api/v1/tasks') {
    const jsonMock = vi.fn();
    const headerMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock, header: headerMock });

    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url }),
        getResponse: () => ({ status: statusMock, header: headerMock, json: jsonMock }),
      }),
    } as unknown as ArgumentsHost;

    return { host, statusMock, jsonMock, headerMock };
  }

  it('formats AppException subclasses into RFC 7807 Problem Details', () => {
    const { host, statusMock, jsonMock, headerMock } = createMockHost();
    const exception = new ResourceNotFoundException('Tarefa', 'abc-123');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(headerMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://sistema-de-iniciativas-cin.example/problems/not-found',
        title: 'Recurso não encontrado',
        status: 404,
        detail: 'Tarefa com id "abc-123" não encontrado(a).',
        instance: '/api/v1/tasks',
        code: 'NOT_FOUND',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats standard HttpException into Problem Details format', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const exception = new ForbiddenException('Acesso negado.');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        detail: 'Acesso negado.',
        code: 'ACCESS_DENIED',
      }),
    );
  });

  it('groups Zod validation issues by field', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const schema = z.object({ title: z.string().min(3) });
    const result = schema.safeParse({ title: 'a' });
    if (result.success) throw new Error('expected failure');

    filter.catch(result.error, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        errors: expect.objectContaining({ title: expect.any(Array) }),
      }),
    );
  });

  it('falls back to INTERNAL_ERROR for unknown exceptions', () => {
    const { host, statusMock, jsonMock } = createMockHost();

    filter.catch(new Error('boom'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        detail: 'Erro interno do servidor.',
      }),
    );
  });
});
