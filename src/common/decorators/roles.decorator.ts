import { SetMetadata } from '@nestjs/common';
import { GymRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/// Restricts a route to the listed roles *at the caller's own gym*.
export const Roles = (...roles: GymRole[]) => SetMetadata(ROLES_KEY, roles);

/// Convenience for the two roles that run a gym.
export const GymStaffOnly = () => Roles(GymRole.GYM_ADMIN, GymRole.OWNER);
