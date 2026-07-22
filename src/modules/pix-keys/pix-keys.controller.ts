import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreatePixKeyDto } from './dto/create-pix-key.dto';
import { PixKeyEntity } from './entities/pix-key.entity';
import { PixKeysService } from './pix-keys.service';

@ApiTags('Pix Keys')
@ApiBearerAuth()
@Controller('pix-keys')
export class PixKeysController {
  constructor(private readonly pixKeysService: PixKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar uma nova chave Pix' })
  @ApiResponse({
    status: 201,
    type: PixKeyEntity,
    description: 'Chave Pix registrada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Formato de chave inválido ou limite atingido.',
  })
  @ApiResponse({
    status: 409,
    description: 'Chave Pix já registrada.',
  })
  create(
    @CurrentUser() user: SafeUser,
    @Body() createPixKeyDto: CreatePixKeyDto,
  ) {
    return this.pixKeysService.create(user, createPixKeyDto);
  }

  @Get('masked')
  @ApiOperation({ summary: 'Listar todas as chaves Pix mascaradas do usuário' })
  @ApiResponse({
    status: 200,
    type: PixKeyEntity,
    description: 'Lista de chaves Pix mascaradas.',
  })
  findAllMasked(@CurrentUser() user: SafeUser) {
    return this.pixKeysService.findAllMasked(user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as chaves Pix do usuário' })
  @ApiResponse({
    status: 200,
    type: PixKeyEntity,
    description: 'Chaves Pix retornadas com sucesso.',
  })
  findAll(@CurrentUser() user: SafeUser) {
    return this.pixKeysService.findAll(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir uma chave Pix' })
  @ApiResponse({
    status: 200,
    description: 'Chave Pix excluída com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Chave Pix não encontrada.',
  })
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.pixKeysService.remove(user, id);
  }
}
