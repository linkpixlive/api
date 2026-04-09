import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChangePasswordParams } from './dto/change-password.dto';

@Injectable()
export class ChangePasswordRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreateChangePasswordParams) {
    return await this.prismaService.changePassword.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt,
      },
    });
  }

  async deleteManyByUserId(userId: string) {
    return await this.prismaService.changePassword.deleteMany({
      where: { user_id: userId },
    });
  }

  async deleteByToken(token: string) {
    return await this.prismaService.changePassword.delete({
      where: { token },
    });
  }

  async findByToken(token: string) {
    return await this.prismaService.changePassword.findUnique({
      where: { token },
    });
  }
}
