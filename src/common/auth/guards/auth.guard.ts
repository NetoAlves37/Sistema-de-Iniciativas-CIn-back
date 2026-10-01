import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import type { CurrentUser } from '../current-user.interface';
import { IDENTITY_SOURCE, type IdentitySource } from '../identity/identity-source.interface';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(IDENTITY_SOURCE) private identitySource: IdentitySource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.identitySource.extract(request);

    if (!user) {
      throw new UnauthorizedException('Identidade não fornecida ou inválida.');
    }

    request.user = user;
    return true;
  }
}
