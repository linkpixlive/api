import { Body, Controller, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { ProfileService } from './profile.service';

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
    @CurrentUser() user: SafeUser,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    return this.profileService.changeUsername(user.id, updateUsernameDto);
  }
}
