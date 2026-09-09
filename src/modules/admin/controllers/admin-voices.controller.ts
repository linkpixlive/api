import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateVoiceDto } from 'src/modules/voices/dto/create-voice.dto';
import { UpdateVoiceDto } from 'src/modules/voices/dto/update-voice.dto';
import { VoiceEntity } from 'src/modules/voices/entities/voice.entity';
import type { VoiceFiles } from '../services/admin-voices.service';
import {
  AdminVoicesService,
  MAX_VOICE_AUDIO_SIZE_BYTES,
} from '../services/admin-voices.service';

@ApiTags('Admin / Voices')
@ApiBearerAuth()
@Controller('admin/voices')
@Roles(UserRole.admin)
export class AdminVoicesController {
  constructor(private readonly adminVoicesService: AdminVoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as vozes' })
  @ApiResponse({ status: 200, type: [VoiceEntity] })
  findAll() {
    return this.adminVoicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter uma voz pelo ID' })
  @ApiResponse({ status: 200, type: VoiceEntity })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  findById(@Param('id') id: string) {
    return this.adminVoicesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar uma nova voz' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateVoiceDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_VOICE_AUDIO_SIZE_BYTES } },
    ),
  )
  @ApiResponse({ status: 201, type: VoiceEntity })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() dto: CreateVoiceDto, @UploadedFiles() files?: VoiceFiles) {
    return this.adminVoicesService.create(dto, files);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma voz' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateVoiceDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_VOICE_AUDIO_SIZE_BYTES } },
    ),
  )
  @ApiResponse({ status: 200, type: VoiceEntity })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVoiceDto,
    @UploadedFiles() files?: VoiceFiles,
  ) {
    return this.adminVoicesService.update(id, dto, files);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover uma voz' })
  @ApiResponse({ status: 204, description: 'Voz removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Voz não encontrada' })
  async remove(@Param('id') id: string) {
    await this.adminVoicesService.remove(id);
  }
}
