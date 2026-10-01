import type { Request } from 'express';
import type { CurrentUser } from '../current-user.interface';

export const IDENTITY_SOURCE = Symbol('IDENTITY_SOURCE');

export interface IdentitySource {
  extract(req: Request): Promise<CurrentUser | null>;
}
