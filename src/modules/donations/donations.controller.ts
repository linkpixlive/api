import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
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
}
