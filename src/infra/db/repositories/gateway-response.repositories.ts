import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateGatewayResponseParams } from './dto/gateway-response.dto';

@Injectable()
export class GatewayResponseRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreateGatewayResponseParams) {
    return await this.prismaService.gatewayResponse.create({
      data: {
        interactionType: data.interactionType,
        provider: data.provider,
        payload: data.payload as Prisma.InputJsonValue,
        externalId: data.externalId,
        statusCode: data.statusCode,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.gatewayResponse.findUnique({
      where: { id },
    });
  }
}
