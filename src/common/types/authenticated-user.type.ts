import { Gym, GymRole } from '@prisma/client';

/// Shape attached to `request.user` after a valid access token is verified.
/// Always gym-scoped: the same person can hold a different role at another gym.
export interface AuthenticatedUser {
  id: string;
  phone: string;
  gymId: string;
  gymUserId: string;
  role: GymRole;
  isPlatformAdmin: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  gymId: string;
  role: GymRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  /// Refresh token record id - lets us revoke the exact stored token.
  jti: string;
  gymId: string;
  familyId: string;
  iat?: number;
  exp?: number;
}

/// Attached to every request by GymContextMiddleware when the caller sends the
/// gym header.
export type RequestGym = Pick<
  Gym,
  'id' | 'code' | 'name' | 'timezone' | 'currency' | 'isActive'
>;
