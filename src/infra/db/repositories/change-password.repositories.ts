import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChangePasswordParams } from './dto/change-password.dto';

@Injectable()
export class ChangePasswordRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreateChangePasswordParams) {
    return await this.prismaService.changePassword.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  async deleteManyByUserId(userId: string) {
    return await this.prismaService.changePassword.deleteMany({
      where: { userId: userId },
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
