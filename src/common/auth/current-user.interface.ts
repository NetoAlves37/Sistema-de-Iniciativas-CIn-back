import type { AccessRole } from './access-role.enum';

export interface CurrentUser {
  userId?: string;
  role: AccessRole;
}
