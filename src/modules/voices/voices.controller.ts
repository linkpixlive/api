import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateVoiceDto } from './dto/create-voice.dto';
import { UpdateVoiceDto } from './dto/update-voice.dto';
import { VoiceEntity } from './entities/voice.entity';
import { VoicesService } from './voices.service';

@ApiTags('Admin / Voices')
@ApiBearerAuth()
@Controller('admin/voices')
@Roles(UserRole.admin)
export class VoicesController {
  constructor(private readonly voicesService: VoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as vozes' })
  @ApiResponse({ status: 200, type: [VoiceEntity] })
  findAll() {
    return this.voicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter uma voz pelo ID' })
  @ApiResponse({ status: 200, type: VoiceEntity })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  findById(@Param('id') id: string) {
    return this.voicesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar uma nova voz' })
  @ApiResponse({ status: 201, type: VoiceEntity })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() dto: CreateVoiceDto) {
    return this.voicesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma voz' })
  @ApiResponse({ status: 200, type: VoiceEntity })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  update(@Param('id') id: string, @Body() dto: UpdateVoiceDto) {
    return this.voicesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover uma voz' })
  @ApiResponse({ status: 204, description: 'Voz removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  async remove(@Param('id') id: string) {
    await this.voicesService.remove(id);
  }
}
