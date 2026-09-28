import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { decryptData } from 'src/common/utils/crypto.util';

interface StepUpUser {
  password: string;
  totpEnabled: boolean;
  totpSecret: string | null;
}

const REAUTHENTICATION_ERROR = 'Reautenticação inválida.';

export async function assertPassword(
  user: StepUpUser,
  password?: string,
): Promise<void> {
  if (!password || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedException(REAUTHENTICATION_ERROR);
  }
}

export function assertTotp(user: StepUpUser, totp?: string): void {
  if (!user.totpEnabled || !user.totpSecret || !totp) {
    throw new UnauthorizedException(REAUTHENTICATION_ERROR);
  }

  const secret = decryptData(user.totpSecret);

  try {
    if (!verifySync({ token: totp, secret }).valid) {
      throw new UnauthorizedException(REAUTHENTICATION_ERROR);
    }
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException(REAUTHENTICATION_ERROR);
  }
}

export async function assertPasswordWithOptionalTotp(
  user: StepUpUser,
  password?: string,
  totp?: string,
): Promise<void> {
  await assertPassword(user, password);

  if (user.totpEnabled) {
    assertTotp(user, totp);
  }
}
