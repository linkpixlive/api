import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FindWalletParams } from './dto/wallets.dto';

@Injectable()
export class WalletsRepository {
  constructor(private prismaService: PrismaService) {}

  async findByUserId(params: FindWalletParams) {
    return await this.prismaService.wallet.findUnique({
      where: { userId: params.userId },
    });
  }
}
