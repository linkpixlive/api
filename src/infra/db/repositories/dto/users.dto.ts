export interface CreateUserParams {
  name: string;
  username: string;
  email: string;
  password: string;
  cpf: string;
  cpfHash: string;
  verifiedEmail?: boolean;
}

export interface UpdateUserParams {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  cpf?: string;
  cpfHash?: string;
  verifiedEmail?: boolean;
}
