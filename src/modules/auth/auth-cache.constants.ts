export const authSessionCacheKey = (userId: string) => `auth:session:${userId}`;

export interface CachedAuthSession {
  active: boolean;
  user?: {
    id: string;
    email: string | null;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
  };
}
