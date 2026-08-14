import { Role } from '@prisma/client';

/// Shape attached to `request.user` after a valid access token is verified.
export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  /// Refresh token record id - lets us revoke the exact stored token.
  jti: string;
  familyId: string;
  iat?: number;
  exp?: number;
}
