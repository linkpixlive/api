import { ApiHideProperty } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

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

  @ApiHideProperty()
  @Expose()
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
  roles: UserRole[];

  constructor(partial: Partial<SafeUser>) {
    Object.assign(this, partial);
  }

  static fromPrisma(user: User): SafeUser {
    return new SafeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      profileImageUrl: user.profileImageUrl,
      cpf: user.cpf,
      createdAt: user.createdAt,
      active: user.active,
      verifiedEmail: user.verifiedEmail,
      roles: user.roles,
    });
  }
}
