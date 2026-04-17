import { ApiHideProperty } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

export class SafeUser {
  @ApiHideProperty()
  id: string;

  @ApiHideProperty()
  name: string;

  @ApiHideProperty()
  email: string;

  @ApiHideProperty()
  username: string;

  @ApiHideProperty()
  profileImageUrl: string | null;

  @ApiHideProperty()
  cpf: string | null;

  @ApiHideProperty()
  createdAt: Date;

  @ApiHideProperty()
  active: boolean;

  @ApiHideProperty()
  verifiedEmail: boolean;

  @ApiHideProperty()
  roles: UserRole[];

  @ApiHideProperty()
  overlayKey: string;

  constructor(partial: Partial<SafeUser>) {
    Object.assign(this, partial);
  }

  static fromPrisma(user: User): SafeUser {
    return new SafeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      profileImageUrl: user.profile_image_url,
      cpf: user.cpf,
      createdAt: user.created_at,
      active: user.active,
      verifiedEmail: user.verified_email,
      roles: user.roles,
      overlayKey: user.overlay_key,
    });
  }
}
