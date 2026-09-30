import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

@Exclude()
export class AccountEntity {
  @ApiHideProperty() @Expose() id: string;

  @ApiProperty({ example: 'j***@email.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: true })
  @Expose()
  has2fa: boolean;

  @ApiProperty({ example: true })
  @Expose()
  active: boolean;

  @ApiProperty({
    example: '2026-08-04T21:50:00.000Z',
    description: 'Data da última alteração de nome de usuário',
  })
  @Expose()
  usernameChangedAt: Date | null;

  @ApiProperty({ example: true, description: 'Email verificado' })
  @Expose()
  verifiedEmail: boolean;

  constructor(partial: Partial<AccountEntity>) {
    Object.assign(this, partial);
  }

  static fromAuthenticatedUser(user: AuthenticatedUser): AccountEntity {
    return new AccountEntity({
      id: user.id,
      email: maskEmail(user.email),
      has2fa: user.totpEnabled,
      active: user.active,
      usernameChangedAt: user.usernameChangedAt,
      verifiedEmail: user.verifiedEmail,
    });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 1) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${
    local[local.length - 1]
  }@${domain}`;
}
