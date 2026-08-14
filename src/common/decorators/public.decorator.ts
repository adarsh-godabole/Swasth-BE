import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/// Marks a route as reachable without an access token. Auth is on by default.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
