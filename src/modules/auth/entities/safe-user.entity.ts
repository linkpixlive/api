import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';

@Exclude()
export class SafeUser {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @Expose()
  id: string;

  @ApiProperty({ example: 'John Doe' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'johndoe@email.com', format: 'email' })
  @Expose()
  email: string;

  @ApiProperty({ example: 'johndoe' })
  @Expose()
  username: string;

  @ApiProperty({
    example: 'https://cdn.linkpix.com.br/avatars/uuid.webp',
    nullable: true,
  })
  @Expose()
  profileImageUrl: string | null;

  @ApiProperty({ example: null, nullable: true })
  cpf: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: true })
  @Expose()
  active: boolean;

  @ApiProperty({ example: true })
  @Expose()
  verifiedEmail: boolean;

  @ApiProperty({
    example: '2026-08-04T21:50:00.000Z',
    nullable: true,
  })
  @Expose()
  usernameChangedAt: Date | null;

  @ApiProperty({ example: ['streamer'], isArray: true })
  @Expose()
  roles: UserRole[];

  @Exclude()
  password: string;

  @Exclude()
  totpSecret: string | null;

  @ApiProperty({ example: false })
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
      profileImageUrl: getStorageUrl(user.profileImageUrl),
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
