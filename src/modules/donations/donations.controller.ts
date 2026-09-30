import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/isPublic';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { DonationStatusEntity } from './entities/donation-status.entity';
import { DonationEntity } from './entities/donation.entity';
import { PaginatedDonationHistoryResponse } from './entities/paginated-donation-history.entity';
import { PublicUserEntity } from './entities/public-user.entity';

@ApiTags('Donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('user/:username')
  @Public()
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
    default: { limit: 60, ttl: 600000 },
  })
  async getUser(@Param('username') username: string) {
    return this.donationsService.getUser(username);
  }

  @Post('donation')
  @Public()
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
    status: 404,
    description: 'Usuário não encontrado ou indisponível',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições (Limite de taxa).',
  })
  @Throttle({
    burst: { limit: 2, ttl: 10000 },
    default: { limit: 15, ttl: 3600000 },
  })
  donation(@Body() donationDto: DonationDto, @Ip() ip: string) {
    return this.donationsService.donation(donationDto, ip);
  }

  @Get('donation/:id')
  @Public()
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
    default: { limit: 120, ttl: 3600000 },
  })
  getDonation(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.donationsService.getDonation(id);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter histórico de doações paginado' })
  @ApiResponse({
    status: 200,
    type: PaginatedDonationHistoryResponse,
    description: 'Histórico retornado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Parâmetros de query inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetHistoryQueryDto,
  ) {
    return this.donationsService.getHistory(user.id, query);
  }

  @Get('history/:id/audio')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Baixar áudio da doação como anexo' })
  @ApiResponse({ status: 200, description: 'Arquivo de áudio.' })
  @ApiResponse({ status: 404, description: 'Áudio não disponível.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async downloadAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const audio = await this.donationsService.getDonationAudio(user.id, id);
    res.set({
      'Content-Type': audio.contentType,
      'Content-Disposition': `attachment; filename="${audio.filename}"`,
      ...(audio.contentLength !== undefined
        ? { 'Content-Length': String(audio.contentLength) }
        : {}),
    });
    return new StreamableFile(audio.stream);
  }
}
