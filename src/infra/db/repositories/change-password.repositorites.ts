import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChangePasswordRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: Prisma.ChangePasswordCreateArgs) {
    return await this.prismaService.changePassword.create(data);
  }

  async deleteMany(data: Prisma.ChangePasswordDeleteManyArgs) {
    return await this.prismaService.changePassword.deleteMany(data);
  }

  async delete(data: Prisma.ChangePasswordDeleteArgs) {
    return await this.prismaService.changePassword.delete(data);
  }

  async getBy(data: Prisma.ChangePasswordWhereUniqueInput) {
    return await this.prismaService.changePassword.findUnique({ where: data });
  }
}
