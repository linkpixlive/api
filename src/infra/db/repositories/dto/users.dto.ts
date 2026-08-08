import { UserRole } from '@prisma/client';

export interface CreateUserParams {
  name: string;
  username: string;
  email: string;
  password: string;
  cpf: string;
  cpfHash: string;
  verifiedEmail?: boolean;
  verified?: boolean;
  usernameChangedAt?: Date;
  roles?: UserRole[];
}

export interface UpdateUserParams {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  cpf?: string;
  cpfHash?: string;
  verifiedEmail?: boolean;
  verified?: boolean;
  usernameChangedAt?: Date;
  roles?: UserRole[];
  totpSecret?: string | null;
  totpEnabled?: boolean;
  active?: boolean;
}
