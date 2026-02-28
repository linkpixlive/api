import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: Prisma.UserCreateArgs) {
    return await this.prismaService.user.create(data);
  }

  async getBy(data: Prisma.UserWhereUniqueInput) {
    return await this.prismaService.user.findUnique({ where: data });
  }
}
