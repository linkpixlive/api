import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { UploadedFile as MulterUploadedFile } from 'src/common/interfaces/uploaded-file.interface';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { UploadProfilePhotoDto } from './dto/upload-profile-photo.dto';
import {
  MAX_PROFILE_PHOTO_SIZE_BYTES,
  ProfileService,
} from './profile.service';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch('username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar nome de usuário' })
  @ApiResponse({
    status: 200,
    description: 'Nome de usuário alterado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou regras de negócio violadas.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado.',
  })
  changeUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    return this.profileService.changeUsername(user.id, updateUsernameDto);
  }

  @Put('photo')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROFILE_PHOTO_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadProfilePhotoDto })
  @ApiOperation({ summary: 'Enviar ou substituir a foto de perfil' })
  @ApiResponse({
    status: 200,
    description: 'Foto de perfil atualizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Arquivo ausente ou formato/tamanho inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado.',
  })
  uploadProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: MulterUploadedFile,
  ) {
    return this.profileService.uploadProfilePhoto(user.id, file);
  }

  @Delete('photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover a foto de perfil' })
  @ApiResponse({
    status: 200,
    description: 'Foto de perfil removida com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado.',
  })
  removeProfilePhoto(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.removeProfilePhoto(user.id);
  }
}
