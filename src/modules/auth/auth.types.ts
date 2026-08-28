import { Request } from 'express';
import { User } from '@entities';

export interface JwtPayload {
  sub: string;
  email?: string;
  roles: string[];
}

export type AuthenticatedUser = User & { roles: string[] };

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
