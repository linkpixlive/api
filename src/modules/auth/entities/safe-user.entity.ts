import { ApiHideProperty } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';
import { getProfileImageUrl } from 'src/common/utils/profileImageUrl.util';

@Exclude()
export class SafeUser {
  @ApiHideProperty()
  @Expose()
  id: string;

  @ApiHideProperty()
  @Expose()
  name: string;

  @ApiHideProperty()
  @Expose()
  email: string;

  @ApiHideProperty()
  @Expose()
  username: string;

  @ApiHideProperty()
  @Expose()
  profileImageUrl: string | null;

  cpf: string | null;

  @ApiHideProperty()
  @Expose()
  createdAt: Date;

  @ApiHideProperty()
  @Expose()
  active: boolean;

  @ApiHideProperty()
  @Expose()
  verifiedEmail: boolean;

  @ApiHideProperty()
  @Expose()
  usernameChangedAt: Date | null;

  @ApiHideProperty()
  @Expose()
  roles: UserRole[];

  @ApiHideProperty()
  @Exclude()
  password: string;

  @ApiHideProperty()
  @Exclude()
  totpSecret: string | null;

  @ApiHideProperty()
  @Expose()
  totpEnabled: boolean;

  constructor(partial: Partial<SafeUser>) {
    Object.assign(this, partial);
  }

  static fromPrisma(user: User): SafeUser {
    return new SafeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      profileImageUrl: getProfileImageUrl(user.profileImageUrl),
      cpf: user.cpf,
      createdAt: user.createdAt,
      active: user.active,
      verifiedEmail: user.verifiedEmail,
      usernameChangedAt: user.usernameChangedAt,
      roles: user.roles,
      password: user.password,
      totpSecret: user.totpSecret,
      totpEnabled: user.totpEnabled,
    });
  }
}
