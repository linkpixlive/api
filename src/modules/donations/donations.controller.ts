import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { DonationStatusEntity } from './entities/donation-status.entity';
import { DonationEntity } from './entities/donation.entity';
import { PublicUserEntity } from './entities/public-user.entity';

@ApiTags('Donations')
@Public()
@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('/user/:username')
  @ApiOperation({ summary: 'Obter informações públicas do usuário' })
  @ApiResponse({
    status: 200,
    type: PublicUserEntity,
    description: 'Informações do usuário recebidas com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições.',
  })
  @Throttle({
    burst: { limit: 10, ttl: 10000 },
    username_lookup: { limit: 60, ttl: 600000 },
  })
  async getUser(@Param('username') username: string) {
    return this.donationsService.getUser(username);
  }

  @Post('donation')
  @ApiOperation({ summary: 'Criar uma nova doação' })
  @ApiResponse({
    status: 201,
    type: DonationEntity,
    description: 'Doação criada, retorna código Pix e informações da doação.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (amount, userId, voiceId...)',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições (Limite de taxa).',
  })
  @Throttle({
    burst: { limit: 2, ttl: 10000 },
    donation_create: { limit: 15, ttl: 3600000 },
  })
  donation(@Body() donationDto: DonationDto, @Ip() ip: string) {
    return this.donationsService.donation(donationDto, ip);
  }

  @Get('donation/:id')
  @ApiOperation({
    summary: 'Obter status de pagamento de uma doação',
  })
  @ApiResponse({
    status: 200,
    type: DonationStatusEntity,
    description: 'Doação encontrada com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Doação não encontrada',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições.',
  })
  @Throttle({
    burst: { limit: 20, ttl: 10000 },
    donation_status: { limit: 120, ttl: 3600000 },
  })
  getDonation(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.donationsService.getDonation(id);
  }
}
