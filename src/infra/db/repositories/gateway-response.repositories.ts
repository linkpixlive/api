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
        interaction_type: data.interactionType,
        provider: data.provider,
        payload: data.payload as Prisma.InputJsonValue,
        external_id: data.externalId,
        status_code: data.statusCode,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.gatewayResponse.findUnique({
      where: { id },
    });
  }
}
