import { SetMetadata } from '@nestjs/common';
import type { AccessRole } from '../access-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);
