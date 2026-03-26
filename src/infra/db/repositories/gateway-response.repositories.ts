import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GatewayResponseRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: Prisma.GatewayResponseCreateArgs) {
    return await this.prismaService.gatewayResponse.create(data);
  }

  async getBy(data: Prisma.GatewayResponseWhereUniqueInput) {
    return await this.prismaService.gatewayResponse.findUnique({ where: data });
  }
}
