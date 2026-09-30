import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  username: string;
  profileImageUrl: string | null;
  createdAt: Date;
  active: boolean;
  verifiedEmail: boolean;
  usernameChangedAt: Date | null;
  roles: UserRole[];
  totpEnabled: boolean;
}
