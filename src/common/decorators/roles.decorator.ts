import { UserRoleEnum } from '@entities';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRoleEnum[]) => {
  return SetMetadata(ROLES_KEY, roles);
};
