import { UserRole } from '@prisma/client';

export interface CreateUserParams {
  name: string;
  username: string;
  email: string;
  password: string;
  cpf: string;
  cpfHash: string;
  verifiedEmail?: boolean;
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
  roles?: UserRole[];
}
