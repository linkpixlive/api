import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { VerifyUserDto } from './dto/verify-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    return this.usersService.changeUsername(user.id, updateUsernameDto);
  }

  @Patch(':id/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Verificar/desverificar um usuário (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Status de verificação atualizado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Usuário não encontrado.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão.',
  })
  verifyUser(@Param('id') id: string, @Body() verifyUserDto: VerifyUserDto) {
    return this.usersService.verifyUser(id, verifyUserDto);
  }
}
