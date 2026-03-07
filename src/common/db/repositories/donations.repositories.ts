import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DonationsRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: Prisma.DonationCreateArgs) {
    return await this.prismaService.donation.create(data);
  }

  async getBy(data: Prisma.DonationWhereUniqueInput) {
    return await this.prismaService.donation.findUnique({ where: data });
  }

  async update(data: Prisma.DonationUpdateArgs) {
    return await this.prismaService.donation.update(data);
  }
}
